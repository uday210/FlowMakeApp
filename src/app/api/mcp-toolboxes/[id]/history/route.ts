import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/mcp-toolboxes/[id]/history?limit=50&offset=0&tool=tool_name&status=success
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify server belongs to org
  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 100);
  const offset = parseInt(sp.get("offset") ?? "0");
  const toolFilter = sp.get("tool");
  const statusFilter = sp.get("status");

  let query = ctx.admin
    .from("mcp_tool_executions")
    .select("id, tool_name, input_data, output_text, status, error_message, duration_ms, transport, created_at")
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (toolFilter) query = query.eq("tool_name", toolFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// DELETE /api/mcp-toolboxes/[id]/history — clear all history for a server
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await ctx.admin
    .from("mcp_tool_executions")
    .delete()
    .eq("server_id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
