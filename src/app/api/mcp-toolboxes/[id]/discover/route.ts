import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/mcp-toolboxes/[id]/discover
// Connects to an external MCP server, calls tools/list, caches result.
// Supports both plain JSON and SSE-streamed responses (Streamable HTTP transport).
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (server.auth_key) headers["Authorization"] = server.auth_key;

  const send = (payload: unknown) =>
    fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

  // Parse plain JSON or SSE stream, returning the JSON-RPC envelope
  const parseResponse = async (res: Response): Promise<unknown> => {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/event-stream")) {
      const text = await res.text();
      let last: unknown = null;
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try { last = JSON.parse(line.slice(6)); } catch { /* skip */ }
        }
      }
      return last;
    }
    return res.json();
  };

  let tools: unknown[] = [];

  try {
    // Initialize (required by Streamable HTTP transport)
    const initRes = await send({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FlowMake", version: "1.0" },
      },
    });
    if (!initRes.ok) {
      let detail = "";
      try { detail = (await initRes.text()).slice(0, 200); } catch { /* ignore */ }
      throw new Error(`HTTP ${initRes.status}${detail ? `: ${detail}` : ""}`);
    }

    // List tools
    const listRes = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status} on tools/list`);

    const json = await parseResponse(listRes) as { result?: { tools?: unknown[] }; error?: { message: string } } | null;
    if ((json as { error?: { message: string } })?.error) {
      throw new Error((json as { error: { message: string } }).error.message);
    }
    tools = (json as { result?: { tools?: unknown[] } })?.result?.tools ?? [];
  } catch (err) {
    await ctx.admin.from("mcp_toolboxes")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId);
    return NextResponse.json({
      error: `Could not connect: ${err instanceof Error ? err.message : String(err)}`,
      status: "error",
    }, { status: 502 });
  }

  await ctx.admin.from("mcp_toolboxes").update({
    status: "connected",
    tools_cache: tools,
    last_discovered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("org_id", ctx.orgId);

  return NextResponse.json({ status: "connected", tools, count: tools.length });
}
