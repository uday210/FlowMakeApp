import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type JsonRpcEnvelope = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
};

async function readSseResponse(res: Response): Promise<JsonRpcEnvelope | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      for (const line of buf.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(line.slice(6)) as JsonRpcEnvelope;
            if ("result" in parsed || "error" in parsed) {
              reader.cancel();
              return parsed;
            }
          } catch { /* keep buffering */ }
        }
      }
      const lastNewline = buf.lastIndexOf("\n");
      if (lastNewline !== -1) buf = buf.slice(lastNewline + 1);
    }
  } finally {
    reader.releaseLock();
  }
  return null;
}

async function parseResponse(res: Response): Promise<JsonRpcEnvelope | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) return readSseResponse(res);
  return res.json() as Promise<JsonRpcEnvelope>;
}

async function resolveClassicSseEndpoint(
  url: string,
  headers: Record<string, string>
): Promise<string | null> {
  const getHeaders: Record<string, string> = { ...headers, Accept: "text/event-stream" };
  delete getHeaders["Content-Type"];
  const res = await fetch(url, { method: "GET", headers: getHeaders, signal: AbortSignal.timeout(10000) });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let endpoint: string | null = null;
  try {
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith("data: ")) {
          const data = lines[i].slice(6).trim();
          if (data.startsWith("/") || data.startsWith("http")) {
            endpoint = data.startsWith("http") ? data : new URL(data, url).toString();
            break outer;
          }
        }
      }
      buf = lines[lines.length - 1];
    }
  } finally {
    reader.cancel();
    reader.releaseLock();
  }
  return endpoint;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: server, error: serverErr } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id, url, auth_key, auth_header_name, type")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (serverErr || !server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (server.type !== "external") return NextResponse.json({ error: "Only external servers can be discovered" }, { status: 400 });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (server.auth_key) headers[server.auth_header_name?.trim() || "Authorization"] = server.auth_key;

  let postUrl: string = server.url;
  let tools: unknown[] = [];

  try {
    const initPayload = {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FlowMake", version: "1.0" },
      },
    };

    // Try Streamable HTTP first
    const probeRes = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify(initPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (!probeRes.ok) {
      // Fall back to classic SSE transport
      const sseEndpoint = await resolveClassicSseEndpoint(server.url, headers);
      if (!sseEndpoint) {
        let detail = "";
        try { detail = (await probeRes.text()).slice(0, 200); } catch { /* ignore */ }
        throw new Error(`HTTP ${probeRes.status}${detail ? `: ${detail}` : ""}`);
      }
      postUrl = sseEndpoint;
      const initRes = await fetch(postUrl, {
        method: "POST", headers, body: JSON.stringify(initPayload), signal: AbortSignal.timeout(15000),
      });
      if (!initRes.ok) throw new Error(`HTTP ${initRes.status} on initialize`);
      try { await parseResponse(initRes); } catch { /* ignore */ }
    } else {
      try { await parseResponse(probeRes); } catch { /* ignore */ }
    }

    const listRes = await fetch(postUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(15000),
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status} on tools/list`);

    const json = await parseResponse(listRes);
    if ((json as JsonRpcEnvelope)?.error) throw new Error((json as JsonRpcEnvelope).error?.message ?? "tools/list error");
    tools = ((json as { result?: { tools?: unknown[] } })?.result?.tools) ?? [];
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
