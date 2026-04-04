import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/mcp-discover
// Body: { url: string; auth_key?: string }
// Calls tools/list on the MCP server (Streamable HTTP then SSE fallback)
// and returns the tool list.
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, auth_key } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth_key?.trim()) headers["Authorization"] = `Bearer ${auth_key.trim()}`;

  const initPayload = JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2024-11-05", clientInfo: { name: "FlowMake", version: "1.0" }, capabilities: {} },
  });
  const listPayload = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

  // Try Streamable HTTP first
  try {
    const initRes = await fetch(url.trim(), { method: "POST", headers, body: initPayload, signal: AbortSignal.timeout(8000) });
    if (initRes.ok) {
      const listRes = await fetch(url.trim(), { method: "POST", headers, body: listPayload, signal: AbortSignal.timeout(8000) });
      if (listRes.ok) {
        const json = await listRes.json();
        const tools = json?.result?.tools ?? [];
        if (Array.isArray(tools)) return NextResponse.json({ tools, transport: "http" });
      }
    }
  } catch { /* fall through to SSE */ }

  // SSE fallback — POST to /message endpoint if URL ends with /sse
  const sseMessageUrl = url.trim().replace(/\/sse\/?$/, "/message");
  if (sseMessageUrl !== url.trim()) {
    try {
      const listRes = await fetch(sseMessageUrl, { method: "POST", headers, body: listPayload, signal: AbortSignal.timeout(8000) });
      if (listRes.ok) {
        const json = await listRes.json();
        const tools = json?.result?.tools ?? [];
        if (Array.isArray(tools)) return NextResponse.json({ tools, transport: "sse" });
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ error: "Could not reach MCP server or no tools found. Check the URL and try again." }, { status: 502 });
}
