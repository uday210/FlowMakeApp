import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cronMatches, intervalToCron } from "@/lib/cronMatch";
import type { WorkflowNode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerClient();
  const now = new Date();

  // Fetch all active workflows
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, name, nodes")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!workflows?.length) return NextResponse.json({ triggered: 0, message: "No active workflows" });

  const triggered: { id: string; name: string }[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const wf of workflows) {
    const nodes = wf.nodes as WorkflowNode[];
    const triggerNode = nodes.find((n) =>
      n.data?.type === "trigger_schedule" || n.data?.type === "trigger_interval"
    );

    if (!triggerNode) {
      skipped.push({ id: wf.id, name: wf.name, reason: "No schedule trigger" });
      continue;
    }

    const cfg = triggerNode.data.config;
    let cron: string;

    if (triggerNode.data.type === "trigger_interval") {
      cron = intervalToCron(cfg.every as string, cfg.unit as string);
    } else {
      cron = (cfg.cron as string) || "0 * * * *";
    }

    if (!cronMatches(cron, now)) {
      skipped.push({ id: wf.id, name: wf.name, reason: `Cron "${cron}" does not match ${now.toISOString()}` });
      continue;
    }

    // Execute workflow
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/execute/${wf.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _trigger: "schedule", _cron: cron, _fired_at: now.toISOString() }),
      });
      if (res.ok) {
        triggered.push({ id: wf.id, name: wf.name });
      } else {
        skipped.push({ id: wf.id, name: wf.name, reason: `Execute returned ${res.status}` });
      }
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
