import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Proxy arbitrary MCP JSON-RPC calls from the browser to any MCP server URL.
// Required so the browser avoids CORS issues hitting third-party servers.
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    url: string;
    // Full header value e.g. "Bearer abc123" — passed as-is, no modification
    authHeader?: string;
    // Header name, defaults to "Authorization"
    authHeaderName?: string;
    action: "list" | "call";
    tool?: string;
    args?: Record<string, unknown>;
  };

  if (!body.url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (body.authHeader) {
    const headerName = body.authHeaderName?.trim() || "Authorization";
    headers[headerName] = body.authHeader;
  }

  const start = Date.now();

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
    try { const t = await initRes.text(); detail = t.slice(0, 200); } catch { /* ignore */ }
    return NextResponse.json(
      { error: `Server returned ${initRes.status}${detail ? `: ${detail}` : ""}` },
      { status: 502 }
    );
  }

  if (body.action === "list") {
    const listRes = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    if (!listRes.ok) {
      let detail = "";
      try { const t = await listRes.text(); detail = t.slice(0, 200); } catch { /* ignore */ }
      return NextResponse.json({ error: `tools/list failed (${listRes.status})${detail ? `: ${detail}` : ""}` }, { status: 502 });
    }
    const listJson = await listRes.json();
    return NextResponse.json({ tools: listJson.result?.tools ?? [], duration_ms: Date.now() - start });
  }

  if (body.action === "call") {
    if (!body.tool) return NextResponse.json({ error: "tool is required" }, { status: 400 });
    const callRes = await send({
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: { name: body.tool, arguments: body.args ?? {} },
    });
    const callJson = await callRes.json();
    const duration_ms = Date.now() - start;
    if (callJson.error) {
      return NextResponse.json({ error: callJson.error.message ?? "Tool error", duration_ms }, { status: 200 });
    }
    return NextResponse.json({ result: callJson.result, duration_ms });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
