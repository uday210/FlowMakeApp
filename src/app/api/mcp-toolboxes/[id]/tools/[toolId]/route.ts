import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, toolId } = await params;

  const body = await req.json();
  const allowed = ["name", "display_name", "description", "input_schema", "workflow_id", "enabled"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  const { data, error } = await ctx.admin
    .from("mcp_tools")
    .update(patch)
    .eq("id", toolId)
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, toolId } = await params;

  const { error } = await ctx.admin
    .from("mcp_tools")
    .delete()
    .eq("id", toolId)
    .eq("server_id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
