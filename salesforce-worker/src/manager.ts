import jsforce from "jsforce";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveSubscription, SalesforceConnection, WorkflowRow } from "./types";
import { refreshAccessToken } from "./tokenManager";

/**
 * Derives the Salesforce Streaming API channel from node config.
 *
 * Platform Event:  event_object = "My_Event__e"   → /event/My_Event__e
 * CDC:             cdc_object   = "Account"        → /data/AccountChangeEvents
 */
function deriveChannel(nodeType: string, config: Record<string, unknown>): string | null {
  if (nodeType === "trigger_salesforce_platform_event") {
    const obj = (config.event_object as string)?.trim();
    if (!obj) return null;
    return `/event/${obj}`;
  }
  if (nodeType === "trigger_salesforce_cdc") {
    const obj = (config.cdc_object as string)?.trim().replace(/ChangeEvents?$/i, "");
    if (!obj) return null;
    return `/data/${obj}ChangeEvents`;
  }
  return null;
}

export class SubscriptionManager {
  // workflowId → active subscription
  private subscriptions = new Map<string, ActiveSubscription>();

  // instanceUrl → jsforce Connection (one per Salesforce org)
  private sfConnections = new Map<string, jsforce.Connection>();

  constructor(
    private supabase: SupabaseClient,
    private appUrl: string
  ) {}

  /**
   * Sync running subscriptions against the current set of active SF workflows.
   * Called every 60 seconds.
   */
  async sync(workflows: WorkflowRow[]): Promise<void> {
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
        } catch (err) {
          console.error(`[worker] Failed to subscribe workflow ${wf.id}:`, err);
        }
      }
    }

    console.log(`[worker] Active subscriptions: ${this.subscriptions.size}`);
  }

  private async subscribe(wf: WorkflowRow): Promise<void> {
    const nodes = wf.nodes ?? [];
    const triggerNode = nodes.find((n) =>
      n.data?.type === "trigger_salesforce_cdc" ||
      n.data?.type === "trigger_salesforce_platform_event"
    );
    if (!triggerNode) return;

    const config = triggerNode.data.config;
    const connectionId = config.connectionId as string | undefined;
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

    const creds = connRow.config as SalesforceConnection;
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

    // Get or create a jsforce connection for this Salesforce org
    const sfConn = this.getOrCreateSfConnection(
      creds.instance_url,
      creds.access_token,
      creds.refresh_token,
      connectionId
    );

    // Build a Faye client from jsforce streaming and attach replay extension
    const fayeClient = sfConn.streaming.createClient();

    fayeClient.addExtension({
      incoming(message: Record<string, unknown>, callback: (m: unknown) => void) {
        callback(message);
      },
      outgoing(message: Record<string, unknown>, callback: (m: unknown) => void) {
        if (message.channel === "/meta/subscribe") {
          const ext = (message.ext ?? {}) as Record<string, unknown>;
          ext.replay = { [channel]: replayId };
          message.ext = ext;
        }
        callback(message);
      },
    });

    const handle = fayeClient.subscribe(channel, async (message: Record<string, unknown>) => {
      await this.handleEvent(wf.id, channel, connectionId, creds, message);
    });

    this.subscriptions.set(wf.id, {
      workflowId: wf.id,
      orgId: wf.org_id,
      channel,
      connectionId,
      instanceUrl: creds.instance_url,
      handle: handle as { cancel: () => void },
    });

    console.log(`[worker] Subscribed workflow ${wf.id} → ${channel} (replayId: ${replayId})`);
  }

  private async handleEvent(
    workflowId: string,
    channel: string,
    connectionId: string,
    creds: SalesforceConnection,
    message: Record<string, unknown>
  ): Promise<void> {
    const eventData = (message.payload ?? message.data ?? message) as Record<string, unknown>;
    const eventMeta = (message.event ?? {}) as Record<string, unknown>;
    const newReplayId = eventMeta.replayId as number | undefined;

    console.log(`[worker] Event on ${channel} for workflow ${workflowId} (replayId: ${newReplayId})`);

    // Persist new replayId so we resume correctly after restart
    if (newReplayId !== undefined) {
      await this.saveReplayId(workflowId, channel, newReplayId);
    }

    // If token looks expired, refresh before triggering
    if (creds.access_token && Date.now() > ((creds as unknown as Record<string, unknown>).expiry as number ?? Infinity) - 60_000) {
      try {
        const newToken = await refreshAccessToken(this.supabase, connectionId, creds.refresh_token, creds.instance_url);
        creds.access_token = newToken;
        // Update the sfConnection token
        const sfConn = this.sfConnections.get(creds.instance_url);
        if (sfConn) sfConn.accessToken = newToken;
      } catch (err) {
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
    } catch (err) {
      console.error(`[worker] Failed to trigger workflow ${workflowId}:`, err);
    }
  }

  private getOrCreateSfConnection(
    instanceUrl: string,
    accessToken: string,
    refreshToken: string,
    connectionId: string
  ): jsforce.Connection {
    // Key by instanceUrl — one connection per Salesforce org
    if (this.sfConnections.has(instanceUrl)) {
      return this.sfConnections.get(instanceUrl)!;
    }

    const conn = new jsforce.Connection({
      instanceUrl,
      accessToken,
      refreshToken,
      oauth2: {
        clientId: process.env.SALESFORCE_CLIENT_ID!,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
        redirectUri: `${this.appUrl}/api/oauth/salesforce/callback`,
      },
    });

    // When jsforce auto-refreshes the token, persist it to DB
    conn.on("refresh", async (newAccessToken: string) => {
      console.log(`[worker] Token auto-refreshed for ${instanceUrl}`);
      const { data: connRow } = await this.supabase
        .from("connections")
        .select("config")
        .eq("id", connectionId)
        .single();
      if (connRow) {
        await this.supabase
          .from("connections")
          .update({ config: { ...(connRow.config as object), access_token: newAccessToken } })
          .eq("id", connectionId);
      }
    });

    this.sfConnections.set(instanceUrl, conn);
    return conn;
  }

  private unsubscribe(workflowId: string): void {
    const sub = this.subscriptions.get(workflowId);
    if (sub?.handle) {
      try { sub.handle.cancel(); } catch { /* ignore */ }
    }
    this.subscriptions.delete(workflowId);
  }

  private async getReplayId(workflowId: string, channel: string): Promise<number> {
    const { data } = await this.supabase
      .from("sf_replay_ids")
      .select("replay_id")
      .eq("workflow_id", workflowId)
      .eq("channel", channel)
      .maybeSingle();
    // -1 = only new events from now; -2 = all retained events (last 24h/3days)
    return (data?.replay_id as number) ?? -1;
  }

  private async saveReplayId(workflowId: string, channel: string, replayId: number): Promise<void> {
    await this.supabase.from("sf_replay_ids").upsert(
      { workflow_id: workflowId, channel, replay_id: replayId, updated_at: new Date().toISOString() },
      { onConflict: "workflow_id,channel" }
    );
  }
}
