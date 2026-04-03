import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/plan-limits";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.admin
    .from("connections")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitCheck = await checkPlanLimit(ctx.admin, ctx.orgId, "connections");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Plan limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} connections. Upgrade to create more.` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from("connections")
    .insert({ name: body.name, type: body.type, config: body.config ?? {}, org_id: ctx.orgId })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    supabase: ctx.admin, orgId: ctx.orgId,
    action: "connection.created", resourceType: "connection",
    resourceId: data.id, meta: { name: data.name, type: data.type },
  });

  return NextResponse.json(data, { status: 201 });
}
