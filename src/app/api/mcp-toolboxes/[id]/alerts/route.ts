import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/mcp-toolboxes/[id]/alerts
export async function GET(
  _req: NextRequest,
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

  const { data, error } = await ctx.admin
    .from("mcp_alert_configs")
    .select("*")
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/mcp-toolboxes/[id]/alerts
// Body: { threshold, window_minutes, notify_slack_url?, notify_email?, enabled }
export async function POST(
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

  const body = await req.json();
  const { threshold, window_minutes, notify_slack_url, notify_email, enabled } = body;

  if (threshold == null || window_minutes == null || enabled == null) {
    return NextResponse.json(
      { error: "threshold, window_minutes, and enabled are required" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.admin
    .from("mcp_alert_configs")
    .insert({
      server_id: id,
      org_id: ctx.orgId,
      threshold,
      window_minutes,
      notify_slack_url: notify_slack_url ?? null,
      notify_email: notify_email ?? null,
      enabled,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/mcp-toolboxes/[id]/alerts?alert_id=<uuid>
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const alert_id = req.nextUrl.searchParams.get("alert_id");
  if (!alert_id) return NextResponse.json({ error: "alert_id required" }, { status: 400 });

  const { error } = await ctx.admin
    .from("mcp_alert_configs")
    .delete()
    .eq("id", alert_id)
    .eq("server_id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
