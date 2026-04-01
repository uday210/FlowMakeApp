import { NextRequest, NextResponse } from "next/server";
import { handleMcpRequest } from "@/lib/mcpProtocol";

export const dynamic = "force-dynamic";

// POST /api/mcp/hosted/[slug]
// Streamable HTTP transport (MCP spec 2025-03-26).
// Accepts JSON-RPC and responds directly with JSON.
// Compatible with modern MCP clients (Cline, Claude Desktop, etc.)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const rpc = body as { jsonrpc: string; id?: string | number | null; method: string; params?: unknown };
  if (rpc.jsonrpc !== "2.0") {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC" } },
      { status: 400 }
    );
  }

  const response = await handleMcpRequest(rpc as Parameters<typeof handleMcpRequest>[0], slug);

  if (response === null) {
    // Notification — no response body
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  return NextResponse.json(response, { headers: corsHeaders() });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return NextResponse.json({
    name: "Hosted MCP Server",
    slug,
    transport: ["sse", "http"],
    endpoints: {
      sse: `/api/mcp/hosted/${slug}/sse`,
      http: `/api/mcp/hosted/${slug}`,
    },
  }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
