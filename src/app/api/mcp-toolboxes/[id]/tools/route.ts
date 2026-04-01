import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/mcp-toolboxes/[id]/tools
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.admin
    .from("mcp_tools")
    .select("*")
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/mcp-toolboxes/[id]/tools
// Body: { name, display_name?, description?, input_schema?, workflow_id? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify the server belongs to this org and is hosted
  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id, type")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (server.type !== "hosted") return NextResponse.json({ error: "Only hosted servers can have custom tools" }, { status: 400 });

  const body = await req.json();
  const { name, display_name, description, input_schema, workflow_id } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Validate tool name: lowercase, underscores/hyphens only
  if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
    return NextResponse.json({ error: "Tool name must be lowercase letters, numbers, underscores or hyphens" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("mcp_tools")
    .insert({
      org_id: ctx.orgId,
      server_id: id,
      name,
      display_name: display_name ?? name,
      description: description ?? null,
      input_schema: input_schema ?? { type: "object", properties: {} },
      workflow_id: workflow_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
