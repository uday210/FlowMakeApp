import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface FunnelStep {
  type: "page" | "event";
  value: string;
  label?: string;
}

interface RawEvent {
  type: string;
  path: string | null;
  session_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
}

function matchesStep(e: RawEvent, step: FunnelStep): boolean {
  if (step.type === "page") {
    return e.type === "pageview" && e.path === step.value;
  }
  const name = (e.properties?.name as string) ?? "";
  return (e.type === "custom" || e.type === "click" || e.type === "form_submit") && name === step.value;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; funnelId: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, funnelId } = await params;

  const { data: site } = await ctx.admin.from("web_analytics_sites").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: funnel } = await ctx.admin.from("web_analytics_funnels").select("id, name, steps").eq("id", funnelId).eq("site_id", id).single();
  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 365);
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: events, error } = await ctx.admin
    .from("web_analytics_events")
    .select("type, path, session_id, properties, created_at")
    .eq("site_id", id)
    .gte("created_at", from)
    .not("session_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const steps = funnel.steps as FunnelStep[];
  const allEvents = (events ?? []) as RawEvent[];

  // Group events by session
  const sessionMap = new Map<string, RawEvent[]>();
  for (const e of allEvents) {
    if (!e.session_id) continue;
    if (!sessionMap.has(e.session_id)) sessionMap.set(e.session_id, []);
    sessionMap.get(e.session_id)!.push(e);
  }

  // Count sessions completing each step (in order)
  const stepCounts = new Array(steps.length).fill(0);

  for (const sessionEvents of sessionMap.values()) {
    let lastIdx = -1;
    for (let s = 0; s < steps.length; s++) {
      let found = false;
      for (let i = lastIdx + 1; i < sessionEvents.length; i++) {
        if (matchesStep(sessionEvents[i], steps[s])) {
          lastIdx = i;
          found = true;
          stepCounts[s]++;
          break;
        }
      }
      if (!found) break; // must complete in order
    }
  }

  const total = stepCounts[0] ?? 0;

  return NextResponse.json({
    funnel: { id: funnel.id, name: funnel.name },
    days,
    steps: steps.map((step, i) => ({
      label: step.label || step.value,
      type: step.type,
      value: step.value,
      sessions: stepCounts[i],
      pct_of_total: total > 0 ? Math.round((stepCounts[i] / total) * 100) : 0,
      drop_pct: i === 0 ? 0 : (stepCounts[i - 1] > 0 ? Math.round(((stepCounts[i - 1] - stepCounts[i]) / stepCounts[i - 1]) * 100) : 0),
    })),
    total_entered: total,
    conversion_rate: total > 0 && stepCounts.length > 1 ? Math.round(((stepCounts[stepCounts.length - 1]) / total) * 100) : 0,
  });
}
