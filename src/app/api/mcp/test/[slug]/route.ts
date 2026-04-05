import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ slug: string }> };

// Internal caller — bypasses auth header by using service role to look up the server
// then calls our own hosted MCP endpoint as if it were a client.

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;

  // Must be a logged-in org user
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the server belongs to this org
  const { data: server } = await admin
    .from("mcp_toolboxes")
    .select("id, slug, auth_key, enabled")
    .eq("slug", slug)
    .eq("org_id", ctx.orgId)
    .eq("type", "hosted")
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.enabled) return NextResponse.json({ error: "Server is disabled" }, { status: 403 });

  const body = await req.json() as { action: "list" | "call"; tool?: string; args?: Record<string, unknown> };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const mcpUrl = `${base}/api/mcp/hosted/${slug}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.auth_key) headers["Authorization"] = `Bearer ${server.auth_key}`;

  const start = Date.now();

  if (body.action === "list") {
    // initialize then list tools
    const initRes = await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FlowMake Playground", version: "1.0" },
      }}),
    });
    if (!initRes.ok) return NextResponse.json({ error: "Failed to initialize MCP session" }, { status: 502 });

    const listRes = await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    const listJson = await listRes.json();
    const tools = listJson.result?.tools ?? [];
    return NextResponse.json({ tools, duration_ms: Date.now() - start });
  }

  if (body.action === "call") {
    if (!body.tool) return NextResponse.json({ error: "tool is required" }, { status: 400 });

    // initialize
    await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "FlowMake Playground", version: "1.0" },
      }}),
    });

    const callRes = await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: {
        name: body.tool,
        arguments: body.args ?? {},
      }}),
    });

    const callJson = await callRes.json();
    const duration = Date.now() - start;

    if (callJson.error) {
      return NextResponse.json({ error: callJson.error.message ?? "Tool error", duration_ms: duration }, { status: 200 });
    }

    return NextResponse.json({ result: callJson.result, duration_ms: duration });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
