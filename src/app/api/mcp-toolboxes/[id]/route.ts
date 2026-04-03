import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.admin
    .from("mcp_toolboxes")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const allowed = ["name", "url", "auth_key", "description", "enabled", "status",
                   "transport", "tools_cache", "last_discovered_at", "slug"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await ctx.admin
    .from("mcp_toolboxes")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await ctx.admin
    .from("mcp_toolboxes")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "mcp_toolbox.deleted",
    resourceType: "mcp_toolbox",
    resourceId: id,
  });
  return NextResponse.json({ ok: true });
}
