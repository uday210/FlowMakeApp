import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Proxy arbitrary MCP JSON-RPC calls from the browser to any MCP server URL.
// Supports both plain JSON responses and SSE-streamed responses (Streamable HTTP transport).
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    url: string;
    authHeader?: string;
    authHeaderName?: string;
    action: "list" | "call";
    tool?: string;
    args?: Record<string, unknown>;
  };

  if (!body.url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Required by Streamable HTTP transport (MCP spec 2025-03-26)
    "Accept": "application/json, text/event-stream",
  };
  if (body.authHeader) {
    const headerName = body.authHeaderName?.trim() || "Authorization";
    headers[headerName] = body.authHeader;
  }

  const start = Date.now();

  // Parse a response that may be plain JSON or an SSE stream.
  // Returns the parsed JSON-RPC result object.
  async function parseResponse(res: Response): Promise<unknown> {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/event-stream")) {
      // SSE stream — read all data: lines and parse the last complete JSON-RPC message
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
  }

  const send = (payload: unknown) =>
    fetch(body.url, { method: "POST", headers, body: JSON.stringify(payload) });

  // Initialize
  const initRes = await send({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "FlowMake Playground", version: "1.0" },
    },
  });
  if (!initRes.ok) {
    let detail = "";
    try { detail = (await initRes.text()).slice(0, 300); } catch { /* ignore */ }
    return NextResponse.json(
      { error: `Server returned ${initRes.status}${detail ? `: ${detail}` : ""}` },
      { status: 502 }
    );
  }

  if (body.action === "list") {
    const listRes = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    if (!listRes.ok) {
      let detail = "";
      try { detail = (await listRes.text()).slice(0, 300); } catch { /* ignore */ }
      return NextResponse.json(
        { error: `tools/list failed (${listRes.status})${detail ? `: ${detail}` : ""}` },
        { status: 502 }
      );
    }
    const listJson = await parseResponse(listRes) as { result?: { tools?: unknown[] } } | null;
    const tools = (listJson as { result?: { tools?: unknown[] } })?.result?.tools ?? [];
    return NextResponse.json({ tools, duration_ms: Date.now() - start });
  }

  if (body.action === "call") {
    if (!body.tool) return NextResponse.json({ error: "tool is required" }, { status: 400 });
    const callRes = await send({
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: { name: body.tool, arguments: body.args ?? {} },
    });
    const callJson = await parseResponse(callRes) as { result?: unknown; error?: { message?: string } } | null;
    const duration_ms = Date.now() - start;
    if ((callJson as { error?: { message?: string } })?.error) {
      const err = (callJson as { error: { message?: string } }).error;
      return NextResponse.json({ error: err.message ?? "Tool error", duration_ms });
    }
    return NextResponse.json({ result: (callJson as { result?: unknown })?.result, duration_ms });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
