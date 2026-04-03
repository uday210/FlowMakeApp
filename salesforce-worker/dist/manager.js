"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const jsforce_1 = __importDefault(require("jsforce"));
const tokenManager_1 = require("./tokenManager");
/**
 * Derives the Salesforce Streaming API channel from node config.
 *
 * Platform Event:  event_object = "My_Event__e"   → /event/My_Event__e
 * CDC:             cdc_object   = "Account"        → /data/AccountChangeEvents
 */
function deriveChannel(nodeType, config) {
    if (nodeType === "trigger_salesforce_platform_event") {
        const obj = config.event_object?.trim();
        if (!obj)
            return null;
        return `/event/${obj}`;
    }
    if (nodeType === "trigger_salesforce_cdc") {
        const obj = config.cdc_object?.trim().replace(/ChangeEvents?$/i, "");
        if (!obj)
            return null;
        return `/data/${obj}ChangeEvents`;
    }
    return null;
}
class SubscriptionManager {
    constructor(supabase, appUrl) {
        this.supabase = supabase;
        this.appUrl = appUrl;
        // workflowId → active subscription
        this.subscriptions = new Map();
        // instanceUrl → jsforce Connection (one per Salesforce org)
        this.sfConnections = new Map();
    }
    /**
     * Sync running subscriptions against the current set of active SF workflows.
     * Called every 60 seconds.
     */
    async sync(workflows) {
        const activeIds = new Set(workflows.map((w) => w.id));
        // Unsubscribe workflows that are no longer active
        for (const [wfId] of this.subscriptions) {
            if (!activeIds.has(wfId)) {
                this.unsubscribe(wfId);
                console.log(`[worker] Unsubscribed removed workflow ${wfId}`);
            }
        }
        // Subscribe new workflows
        for (const wf of workflows) {
            if (!this.subscriptions.has(wf.id)) {
                try {
                    await this.subscribe(wf);
                }
                catch (err) {
                    console.error(`[worker] Failed to subscribe workflow ${wf.id}:`, err);
                }
            }
        }
        console.log(`[worker] Active subscriptions: ${this.subscriptions.size}`);
    }
    async subscribe(wf) {
        const nodes = wf.nodes ?? [];
        const triggerNode = nodes.find((n) => n.data?.type === "trigger_salesforce_cdc" ||
            n.data?.type === "trigger_salesforce_platform_event");
        if (!triggerNode)
            return;
        const config = triggerNode.data.config;
        const connectionId = config.connectionId;
        if (!connectionId) {
            console.warn(`[worker] Workflow ${wf.id} has no connectionId — skipping`);
            return;
        }
        // Load Salesforce credentials from DB
        const { data: connRow } = await this.supabase
            .from("connections")
            .select("config")
            .eq("id", connectionId)
            .single();
        if (!connRow) {
            console.warn(`[worker] Connection ${connectionId} not found for workflow ${wf.id}`);
            return;
        }
        const creds = connRow.config;
        if (!creds.access_token || !creds.instance_url) {
            console.warn(`[worker] Connection ${connectionId} missing access_token or instance_url`);
            return;
        }
        const channel = deriveChannel(triggerNode.data.type, config);
        if (!channel) {
            console.warn(`[worker] Could not derive channel for workflow ${wf.id}`);
            return;
        }
        // Get last replayId for this workflow+channel (so we resume from where we left off)
        const replayId = await this.getReplayId(wf.id, channel);
        // Verify the token is still valid before subscribing
        const verifyRes = await fetch(`${creds.instance_url}/services/data/v59.0/limits`, {
            headers: { Authorization: `Bearer ${creds.access_token}` },
        });
        if (verifyRes.status === 401) {
            console.log(`[worker] Token expired for connection ${connectionId} — refreshing`);
            try {
                creds.access_token = await (0, tokenManager_1.refreshAccessToken)(this.supabase, connectionId, creds.refresh_token, creds.instance_url);
            }
            catch (err) {
                console.error(`[worker] Token refresh failed for workflow ${wf.id}:`, err);
                return;
            }
        }
        else {
            console.log(`[worker] Token valid for ${creds.instance_url}`);
        }
        // Get or create a jsforce connection for this Salesforce org
        const sfConn = this.getOrCreateSfConnection(creds.instance_url, creds.access_token, creds.refresh_token, connectionId);
        // Build a Faye client from jsforce streaming and attach replay extension
        const fayeClient = sfConn.streaming.createClient();
        fayeClient.addExtension({
            incoming(message, callback) {
                callback(message);
            },
            outgoing(message, callback) {
                if (message.channel === "/meta/subscribe") {
                    const ext = (message.ext ?? {});
                    ext.replay = { [channel]: replayId };
                    message.ext = ext;
                }
                callback(message);
            },
        });
        // Log CometD meta events for debugging
        fayeClient.on("transport:up", () => console.log(`[worker] CometD transport UP for ${creds.instance_url}`));
        fayeClient.on("transport:down", () => console.error(`[worker] CometD transport DOWN for ${creds.instance_url}`));
        const handle = fayeClient.subscribe(channel, async (message) => {
            console.log(`[worker] RAW event received on ${channel}:`, JSON.stringify(message).slice(0, 300));
            await this.handleEvent(wf.id, channel, connectionId, creds, message);
        });
        // Log subscription errors
        handle.errback?.((err) => {
            console.error(`[worker] Subscription error on ${channel}:`, err);
        });
        this.subscriptions.set(wf.id, {
            workflowId: wf.id,
            orgId: wf.org_id,
            channel,
            connectionId,
            instanceUrl: creds.instance_url,
            handle: handle,
        });
        console.log(`[worker] Subscribed workflow ${wf.id} → ${channel} (replayId: ${replayId})`);
    }
    async handleEvent(workflowId, channel, connectionId, creds, message) {
        const eventData = (message.payload ?? message.data ?? message);
        const eventMeta = (message.event ?? {});
        const newReplayId = eventMeta.replayId;
        console.log(`[worker] Event on ${channel} for workflow ${workflowId} (replayId: ${newReplayId})`);
        // Persist new replayId so we resume correctly after restart
        if (newReplayId !== undefined) {
            await this.saveReplayId(workflowId, channel, newReplayId);
        }
        // If token looks expired, refresh before triggering
        if (creds.access_token && Date.now() > (creds.expiry ?? Infinity) - 60000) {
            try {
                const newToken = await (0, tokenManager_1.refreshAccessToken)(this.supabase, connectionId, creds.refresh_token, creds.instance_url);
                creds.access_token = newToken;
                // Update the sfConnection token
                const sfConn = this.sfConnections.get(creds.instance_url);
                if (sfConn)
                    sfConn.accessToken = newToken;
            }
            catch (err) {
                console.error(`[worker] Token refresh failed for connection ${connectionId}:`, err);
            }
        }
        // Trigger workflow execution on the main app
        try {
            const res = await fetch(`${this.appUrl}/api/execute/${workflowId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel,
                    event: eventMeta,
                    ...eventData,
                }),
            });
            if (!res.ok) {
                console.error(`[worker] Execute returned ${res.status} for workflow ${workflowId}`);
            }
        }
        catch (err) {
            console.error(`[worker] Failed to trigger workflow ${workflowId}:`, err);
        }
    }
    getOrCreateSfConnection(instanceUrl, accessToken, refreshToken, connectionId) {
        // Key by instanceUrl — one connection per Salesforce org
        if (this.sfConnections.has(instanceUrl)) {
            return this.sfConnections.get(instanceUrl);
        }
        const conn = new jsforce_1.default.Connection({
            instanceUrl,
            accessToken,
            refreshToken,
            oauth2: {
                clientId: process.env.SALESFORCE_CLIENT_ID,
                clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
                redirectUri: `${this.appUrl}/api/oauth/salesforce/callback`,
            },
        });
        // When jsforce auto-refreshes the token, persist it to DB
        conn.on("refresh", async (newAccessToken) => {
            console.log(`[worker] Token auto-refreshed for ${instanceUrl}`);
            const { data: connRow } = await this.supabase
                .from("connections")
                .select("config")
                .eq("id", connectionId)
                .single();
            if (connRow) {
                await this.supabase
                    .from("connections")
                    .update({ config: { ...connRow.config, access_token: newAccessToken } })
                    .eq("id", connectionId);
            }
        });
        this.sfConnections.set(instanceUrl, conn);
        return conn;
    }
    unsubscribe(workflowId) {
        const sub = this.subscriptions.get(workflowId);
        if (sub?.handle) {
            try {
                sub.handle.cancel();
            }
            catch { /* ignore */ }
        }
        this.subscriptions.delete(workflowId);
    }
    async getReplayId(workflowId, channel) {
        const { data } = await this.supabase
            .from("sf_replay_ids")
            .select("replay_id")
            .eq("workflow_id", workflowId)
            .eq("channel", channel)
            .maybeSingle();
        // -1 = only new events from now; -2 = all retained events (last 24h/3days)
        return data?.replay_id ?? -1;
    }
    async saveReplayId(workflowId, channel, replayId) {
        await this.supabase.from("sf_replay_ids").upsert({ workflow_id: workflowId, channel, replay_id: replayId, updated_at: new Date().toISOString() }, { onConflict: "workflow_id,channel" });
    }
}
exports.SubscriptionManager = SubscriptionManager;
