import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/mcp-toolboxes/[id]/discover
// Connects to an external MCP server, calls tools/list, caches result
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: server, error: serverErr } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id, url, auth_key, type")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (serverErr || !server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (server.type !== "external") return NextResponse.json({ error: "Only external servers can be discovered" }, { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.auth_key) headers["Authorization"] = `Bearer ${server.auth_key}`;

  let tools: unknown[] = [];
  let newStatus = "connected";

  try {
    const res = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: { tools?: unknown[] }; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    tools = json.result?.tools ?? [];
  } catch (err) {
    newStatus = "error";
    await ctx.admin.from("mcp_toolboxes").update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId);
    return NextResponse.json({
      error: `Could not connect: ${err instanceof Error ? err.message : String(err)}`,
      status: "error",
    }, { status: 502 });
  }

  await ctx.admin.from("mcp_toolboxes").update({
    status: newStatus,
    tools_cache: tools,
    last_discovered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("org_id", ctx.orgId);

  return NextResponse.json({ status: newStatus, tools, count: tools.length });
}
