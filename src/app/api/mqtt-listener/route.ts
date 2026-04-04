import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { WorkflowNode } from "@/lib/types";

export const dynamic = "force-dynamic";
// Allow up to 55 seconds — stays within a 1-min cron window
export const maxDuration = 55;

interface MqttMessage {
  workflowId: string;
  orgId: string;
  topic: string;
  payload: unknown;
  raw: string;
}

async function collectFromBroker(
  workflowId: string,
  orgId: string,
  cfg: Record<string, unknown>,
  collectMs: number
): Promise<MqttMessage[]> {
  try {
    const mqttLib = await import("mqtt");
    const brokerUrl = String(cfg.broker_url || "");
    const topic     = String(cfg.topic || "");
    if (!brokerUrl || !topic) return [];

    const clientOpts: Record<string, unknown> = {};
    if (cfg.client_id) clientOpts.clientId = String(cfg.client_id);
    if (cfg.username)  clientOpts.username  = String(cfg.username);
    if (cfg.password)  clientOpts.password  = String(cfg.password);

    const qos = Number(cfg.qos || 0) as 0 | 1 | 2;

    return await new Promise<MqttMessage[]>((resolve) => {
      const messages: MqttMessage[] = [];
      const client = mqttLib.connect(brokerUrl, clientOpts as Parameters<typeof mqttLib.connect>[1]);

      const done = () => {
        client.end(true);
        resolve(messages);
      };

      const timer = setTimeout(done, collectMs);

      client.on("error", () => { clearTimeout(timer); client.end(true); resolve([]); });
      client.on("connect", () => {
        client.subscribe(topic, { qos }, (err) => {
          if (err) { clearTimeout(timer); client.end(true); resolve([]); }
        });
        client.on("message", (t, msg) => {
          let payload: unknown = msg.toString();
          try { payload = JSON.parse(msg.toString()); } catch { /* keep string */ }
          messages.push({ workflowId, orgId, topic: t, payload, raw: msg.toString() });
        });
      });
    });
  } catch {
    return [];
  }
}

export async function POST() {
  const supabase = createServerClient();

  // Load all active workflows with trigger_mqtt
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, org_id, nodes")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mqttWorkflows = (workflows ?? []).filter(wf => {
    const nodes = wf.nodes as WorkflowNode[];
    return nodes.some(n => n.data?.type === "trigger_mqtt");
  });

  if (!mqttWorkflows.length) {
    return NextResponse.json({ collected: 0, message: "No active MQTT workflows" });
  }

  // Collect for 45 seconds in parallel across all brokers
  const COLLECT_MS = 45_000;
  const allMessages = (await Promise.all(
    mqttWorkflows.map(wf => {
      const nodes = wf.nodes as WorkflowNode[];
      const triggerNode = nodes.find(n => n.data?.type === "trigger_mqtt");
      if (!triggerNode) return Promise.resolve([]);
      return collectFromBroker(wf.id, wf.org_id as string, triggerNode.data.config, COLLECT_MS);
    })
  )).flat();

  if (!allMessages.length) {
    return NextResponse.json({ collected: 0, message: "No MQTT messages received" });
  }

  // Bulk insert into buffer table
  const { error: insertErr } = await supabase.from("mqtt_messages").insert(
    allMessages.map(m => ({
      workflow_id: m.workflowId,
      org_id:      m.orgId,
      topic:       m.topic,
      payload:     m.payload,
      raw:         m.raw,
    }))
  );

  return NextResponse.json({
    collected: allMessages.length,
    error: insertErr?.message ?? null,
  });
}

export async function GET() {
  return POST();
}
