import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { handleMcpRequest } from "@/lib/mcpProtocol";

export const dynamic = "force-dynamic";

/**
 * POST /api/mcp-toolboxes/[id]/test-tool
 * Body: { tool_name: string, arguments: Record<string, unknown> }
 *
 * Works for both hosted and external servers.
 * - Hosted: calls handleMcpRequest directly (no SSE)
 * - External: forwards tools/call JSON-RPC to the external URL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id, slug, url, auth_key, enabled, type")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.enabled) return NextResponse.json({ error: "Server is disabled" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const toolName = body.tool_name as string;
  const args = (body.arguments ?? {}) as Record<string, unknown>;

  if (!toolName) return NextResponse.json({ error: "tool_name is required" }, { status: 400 });

  const startMs = Date.now();

  if (server.type === "hosted") {
    const response = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } },
      server.slug,
      "http"
    );
    return NextResponse.json({ response, duration_ms: Date.now() - startMs });
  }

  // External server — forward JSON-RPC tools/call
  if (!server.url) return NextResponse.json({ error: "External server has no URL" }, { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.auth_key) headers["Authorization"] = `Bearer ${server.auth_key}`;

  try {
    const res = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } }),
      signal: AbortSignal.timeout(30000),
    });
    const json = await res.json();
    return NextResponse.json({ response: json, duration_ms: Date.now() - startMs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
