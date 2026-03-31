import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agentCallable = searchParams.get("agent_callable") === "true";

  let query = ctx.admin
    .from("workflows")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (agentCallable) {
    query = query.filter("nodes", "cs", JSON.stringify([{ data: { type: "trigger_agent" } }]));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitCheck = await checkPlanLimit(ctx.admin, ctx.orgId, "scenarios");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Plan limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} scenarios. Upgrade to create more.` },
      { status: 403 }
    );
  }

  const body = await request.json();

  const { data, error } = await ctx.admin
    .from("workflows")
    .insert({
      name: body.name || "Untitled Scenario",
      description: body.description || "",
      nodes: body.nodes || [],
      edges: body.edges || [],
      is_active: false,
      org_id: ctx.orgId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
