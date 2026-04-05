import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type JsonRpcEnvelope = {
  id?: number;
  result?: unknown;
  error?: { message?: string; code?: number };
};

// Read an SSE stream incrementally, returning the first complete JSON-RPC
// message that contains a result or error (stops reading immediately after).
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
            // Return as soon as we see a message with result or error
            if ("result" in parsed || "error" in parsed) {
              reader.cancel();
              return parsed;
            }
          } catch { /* not valid JSON yet, keep buffering */ }
        }
      }
      // Keep only the last incomplete line in the buffer
      const lastNewline = buf.lastIndexOf("\n");
      if (lastNewline !== -1) buf = buf.slice(lastNewline + 1);
    }
  } finally {
    reader.releaseLock();
  }
  return null;
}

// Parse a response that may be plain JSON or SSE-streamed
async function parseResponse(res: Response): Promise<JsonRpcEnvelope | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    return readSseResponse(res);
  }
  return res.json() as Promise<JsonRpcEnvelope>;
}

// Discover the POST endpoint for classic HTTP+SSE transport (pre-2025 spec).
// Opens a GET SSE connection, reads the "endpoint" event, closes the stream.
async function resolveClassicSseEndpoint(
  url: string,
  headers: Record<string, string>
): Promise<string | null> {
  const getHeaders = { ...headers };
  delete getHeaders["Content-Type"];
  getHeaders["Accept"] = "text/event-stream";

  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders,
    signal: AbortSignal.timeout(10000),
  });
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
        const line = lines[i];
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          // Classic SSE transport sends the message endpoint as the first data event
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
    "Accept": "application/json, text/event-stream",
  };
  if (body.authHeader) {
    const headerName = body.authHeaderName?.trim() || "Authorization";
    headers[headerName] = body.authHeader;
  }

  const start = Date.now();

  // Probe: try Streamable HTTP first (POST initialize).
  // If 4xx, fall back to classic SSE transport (GET for endpoint, then POST).
  let postUrl = body.url;

  const probeRes = await fetch(body.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FlowMake Playground", version: "1.0" },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!probeRes.ok) {
    // Try classic SSE transport
    const sseEndpoint = await resolveClassicSseEndpoint(body.url, headers);
    if (!sseEndpoint) {
      let detail = "";
      try { detail = (await probeRes.text()).slice(0, 300); } catch { /* ignore */ }
      return NextResponse.json(
        { error: `Server returned ${probeRes.status}${detail ? `: ${detail}` : ""}` },
        { status: 502 }
      );
    }
    // Classic SSE: send initialize to the message endpoint
    postUrl = sseEndpoint;
    const initRes = await fetch(postUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "FlowMake Playground", version: "1.0" },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!initRes.ok) {
      let detail = "";
      try { detail = (await initRes.text()).slice(0, 300); } catch { /* ignore */ }
      return NextResponse.json(
        { error: `Server returned ${initRes.status}${detail ? `: ${detail}` : ""}` },
        { status: 502 }
      );
    }
  } else {
    // Drain the initialize response so the connection isn't left hanging
    try { await parseResponse(probeRes); } catch { /* ignore */ }
  }

  const send = (payload: unknown) =>
    fetch(postUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

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
    const listJson = await parseResponse(listRes);
    const tools = (listJson as { result?: { tools?: unknown[] } })?.result?.tools ?? [];
    return NextResponse.json({ tools, duration_ms: Date.now() - start });
  }

  if (body.action === "call") {
    if (!body.tool) return NextResponse.json({ error: "tool is required" }, { status: 400 });
    const callRes = await send({
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: { name: body.tool, arguments: body.args ?? {} },
    });
    const callJson = await parseResponse(callRes);
    const duration_ms = Date.now() - start;
    if ((callJson as JsonRpcEnvelope)?.error) {
      const err = (callJson as JsonRpcEnvelope).error!;
      return NextResponse.json({ error: err.message ?? "Tool error", duration_ms });
    }
    return NextResponse.json({ result: (callJson as JsonRpcEnvelope)?.result, duration_ms });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
