import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { handleMcpRequest } from "@/lib/mcpProtocol";

export const dynamic = "force-dynamic";

/**
 * POST /api/mcp-toolboxes/[id]/tools/[toolId]/test
 * Runs a tool directly from the UI (playground). No SSE session needed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, toolId } = await params;

  // Fetch the server + tool to get the slug and tool name
  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id, slug, enabled, type")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (server.type !== "hosted") return NextResponse.json({ error: "Only hosted servers can be tested here" }, { status: 400 });
  if (!server.enabled) return NextResponse.json({ error: "Server is disabled" }, { status: 400 });

  const { data: tool } = await ctx.admin
    .from("mcp_tools")
    .select("name, enabled")
    .eq("id", toolId)
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  if (!tool.enabled) return NextResponse.json({ error: "Tool is disabled" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const args = (body.arguments ?? {}) as Record<string, unknown>;

  const startMs = Date.now();
  const response = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool.name, arguments: args },
    },
    server.slug,
    "http"
  );
  const duration = Date.now() - startMs;

  return NextResponse.json({ response, duration_ms: duration });
}
