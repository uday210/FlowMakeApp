import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cronMatches, intervalToCron } from "@/lib/cronMatch";
import { executeWorkflow } from "@/lib/executor";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerClient();
  const now = new Date();

  // Fetch all active workflows
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, name, nodes, edges, org_id")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!workflows?.length) return NextResponse.json({ triggered: 0, message: "No active workflows" });

  const triggered: { id: string; name: string }[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  const POLLING_TRIGGERS = new Set([
    "trigger_gmail", "trigger_outlook_email", "trigger_google_sheets",
    "trigger_airtable_record", "trigger_notion_page", "trigger_google_drive",
    "trigger_dropbox_file", "trigger_onedrive_file", "trigger_trello_card",
    "trigger_monday_item", "trigger_mailchimp_subscriber", "trigger_activecampaign",
    "trigger_rss_poll", "trigger_salesforce", "trigger_salesforce_cdc", "trigger_salesforce_platform_event",
    "trigger_postgres_row", "trigger_mysql_row", "trigger_mongodb_document",
  ]);

  for (const wf of workflows) {
    const nodes = wf.nodes as WorkflowNode[];
    const triggerNode = nodes.find((n) =>
      n.data?.type === "trigger_schedule" ||
      n.data?.type === "trigger_interval" ||
      n.data?.type === "trigger_mqtt" ||
      POLLING_TRIGGERS.has(n.data?.type)
    );

    if (!triggerNode) {
      skipped.push({ id: wf.id, name: wf.name, reason: "No schedule trigger" });
      continue;
    }

    const cfg = triggerNode.data.config;

    // ── MQTT trigger — read from buffer table instead of connecting live ────
    if (triggerNode.data.type === "trigger_mqtt") {
      const { data: buffered } = await supabase
        .from("mqtt_messages")
        .select("id, topic, payload, raw, received_at")
        .eq("workflow_id", wf.id)
        .eq("processed", false)
        .order("received_at", { ascending: true })
        .limit(50);

      if (!buffered?.length) {
        skipped.push({ id: wf.id, name: wf.name, reason: "MQTT: no buffered messages" });
        continue;
      }

      // Mark all as processed immediately to avoid double-firing
      const ids = buffered.map(m => m.id);
      await supabase.from("mqtt_messages").update({ processed: true }).in("id", ids);

      // Fire one execution per message
      const connectionIds = [...new Set(nodes.map(n => n.data?.config?.connectionId as string | undefined).filter(Boolean) as string[])];
      const connectionsMap: Record<string, Record<string, unknown>> = {};
      if (connectionIds.length > 0) {
        const { data: conns } = await supabase.from("connections").select("id, config").in("id", connectionIds);
        for (const conn of conns ?? []) connectionsMap[conn.id] = conn.config as Record<string, unknown>;
      }

      for (const msg of buffered) {
        const triggerData = {
          topic:       msg.topic,
          payload:     msg.payload,
          raw:         msg.raw,
          _fired_at:   msg.received_at,
        };
        const { data: execution } = await supabase.from("executions")
          .insert({ workflow_id: wf.id, status: "running", trigger_data: triggerData, logs: [] })
          .select().single();
        let finalStatus: "success" | "failed" = "success";
        let ctx;
        try {
          ctx = await executeWorkflow(nodes, wf.edges as WorkflowEdge[], triggerData, connectionsMap, wf.id, wf.org_id as string | undefined);
          if (ctx.logs.some(l => l.status === "error")) finalStatus = "failed";
        } catch { finalStatus = "failed"; ctx = { logs: [] }; }
        if (execution) await supabase.from("executions").update({ status: finalStatus, logs: ctx.logs, finished_at: new Date().toISOString() }).eq("id", execution.id);
      }

      triggered.push({ id: wf.id, name: wf.name });
      continue;
    }

    // ── Schedule / interval / polling triggers ──────────────────────────────
    let cron: string;
    if (triggerNode.data.type === "trigger_interval") {
      cron = intervalToCron(cfg.every as string, cfg.unit as string);
    } else if (POLLING_TRIGGERS.has(triggerNode.data.type)) {
      const mins = Number(cfg.poll_interval) || 15;
      cron = mins >= 60 ? `0 */${Math.floor(mins / 60)} * * *` : `*/${mins} * * * *`;
    } else {
      cron = (cfg.cron as string) || "0 * * * *";
    }

    if (!cronMatches(cron, now)) {
      skipped.push({ id: wf.id, name: wf.name, reason: `Cron "${cron}" does not match ${now.toISOString()}` });
      continue;
    }

    try {
      const triggerData = POLLING_TRIGGERS.has(triggerNode.data.type)
        ? { _trigger: "poll", _trigger_type: triggerNode.data.type, _fired_at: now.toISOString() }
        : { _trigger: "schedule", _cron: cron, _fired_at: now.toISOString() };

      const connectionIds = [...new Set(
        nodes.map(n => n.data?.config?.connectionId as string | undefined).filter(Boolean) as string[]
      )];
      const connectionsMap: Record<string, Record<string, unknown>> = {};
      if (connectionIds.length > 0) {
        const { data: conns } = await supabase.from("connections").select("id, config").in("id", connectionIds);
        for (const conn of conns ?? []) connectionsMap[conn.id] = conn.config as Record<string, unknown>;
      }

      const { data: execution } = await supabase
        .from("executions")
        .insert({ workflow_id: wf.id, status: "running", trigger_data: triggerData, logs: [] })
        .select()
        .single();

      let finalStatus: "success" | "failed" = "success";
      let ctx;
      try {
        ctx = await executeWorkflow(nodes, wf.edges as WorkflowEdge[], triggerData, connectionsMap, wf.id, wf.org_id as string | undefined);
        if (ctx.logs.some(l => l.status === "error")) finalStatus = "failed";
      } catch {
        finalStatus = "failed";
        ctx = { logs: [] };
      }

      if (execution) {
        await supabase.from("executions").update({ status: finalStatus, logs: ctx.logs, finished_at: new Date().toISOString() }).eq("id", execution.id);
      }

      triggered.push({ id: wf.id, name: wf.name });
    } catch (err) {
      skipped.push({ id: wf.id, name: wf.name, reason: String(err) });
    }
  }

  return NextResponse.json({
    fired_at: now.toISOString(),
    triggered: triggered.length,
    workflows_triggered: triggered,
    workflows_skipped: skipped,
  });
}

// Allow GET so external cron services (cron-job.org, Vercel Cron, etc.) can hit it too
export async function GET() {
  return POST();
}
