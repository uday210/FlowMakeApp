import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: org } = await ctx.admin
    .from("orgs")
    .select("plan")
    .eq("id", ctx.orgId)
    .single();

  const plan = ((org?.plan as PlanName) ?? "free");
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const [
    { count: scenarios },
    { count: agents },
    { count: tables },
    { count: connections },
    { count: secrets },
    { count: members },
  ] = await Promise.all([
    ctx.admin.from("workflows").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ctx.admin.from("chatbots").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ctx.admin.from("user_tables").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ctx.admin.from("connections").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ctx.admin.from("workflow_secrets").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    ctx.admin.from("profiles").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
  ]);

  return NextResponse.json({
    plan,
    limits,
    usage: {
      scenarios: scenarios ?? 0,
      agents: agents ?? 0,
      tables: tables ?? 0,
      connections: connections ?? 0,
      secrets: secrets ?? 0,
      members: members ?? 0,
    },
  });
}
