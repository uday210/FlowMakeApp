import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("user_tables")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitCheck = await checkPlanLimit(ctx.admin, ctx.orgId, "tables");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Plan limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} tables. Upgrade to create more.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { data, error } = await ctx.admin
    .from("user_tables")
    .insert({
      name: body.name || "Untitled Table",
      description: body.description || "",
      columns: body.columns || [],
      org_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
