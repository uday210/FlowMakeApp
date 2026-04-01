import { NextRequest, NextResponse } from "next/server";
import { mcpSessions } from "@/lib/mcpSessions";
import { handleMcpRequest } from "@/lib/mcpProtocol";

export const dynamic = "force-dynamic";

// POST /api/mcp/hosted/[slug]/message?sessionId=xxx
// Receives JSON-RPC messages from MCP clients connected via SSE transport.
// Sends response back through the matching SSE stream.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = mcpSessions.get(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rpc = body as { jsonrpc: string; id?: string | number | null; method: string; params?: unknown };
  if (rpc.jsonrpc !== "2.0") return NextResponse.json({ error: "Invalid JSON-RPC" }, { status: 400 });

  const response = await handleMcpRequest(rpc as Parameters<typeof handleMcpRequest>[0], slug, "sse");

  if (response !== null) {
    // Send response back via the SSE stream
    session.send("message", JSON.stringify(response));
  }

  // Always return 202 Accepted for SSE transport
  return new NextResponse(null, {
    status: 202,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
