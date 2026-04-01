import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mcpSessions, pruneOldSessions } from "@/lib/mcpSessions";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/mcp/hosted/[slug]/sse
// Establishes an SSE connection per the MCP SSE transport spec.
// Sends an `endpoint` event with the URL clients should POST messages to.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: server } = await admin
    .from("mcp_toolboxes")
    .select("id, org_id, enabled, auth_key")
    .eq("slug", slug)
    .eq("type", "hosted")
    .single();

  if (!server) {
    return new Response("MCP server not found", { status: 404 });
  }
  if (!server.enabled) {
    return new Response("MCP server is disabled", { status: 403 });
  }

  // Auth key check — if the server has a key set, require it as Bearer token
  if (server.auth_key) {
    const authHeader = req.headers.get("authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!provided || provided !== server.auth_key) {
      return new Response("Unauthorized — valid API key required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="MCP Server"' },
      });
    }
  }

  pruneOldSessions();

  const sessionId = randomUUID();
  // Derive public origin from forwarded headers (Railway proxy) or request URL
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : req.headers.get("origin") ?? req.nextUrl.origin;
  const messageUrl = `${origin}/api/mcp/hosted/${slug}/message?sessionId=${sessionId}`;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`)
        );
      };

      mcpSessions.set(sessionId, {
        send,
        orgId: server.org_id,
        serverId: server.id,
        slug,
        createdAt: Date.now(),
      });

      // Send the endpoint event — MCP clients use this URL for all messages
      send("endpoint", messageUrl);
    },
    cancel() {
      mcpSessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
