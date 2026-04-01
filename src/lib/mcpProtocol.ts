/**
 * mcpProtocol.ts — MCP JSON-RPC protocol handler.
 * Shared between SSE message endpoint and Streamable HTTP endpoint.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Execute a workflow as an MCP tool call. Returns the text result. */
async function runWorkflowForTool(workflowId: string, orgId: string, args: Record<string, unknown>): Promise<string> {
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // Load workflow
  const { data: workflow } = await admin
    .from("workflows")
    .select("id, nodes, edges, is_active, org_id")
    .eq("id", workflowId)
    .eq("org_id", orgId)
    .single();

  if (!workflow) throw new Error("Workflow not found");
  if (!workflow.is_active) throw new Error("Workflow is inactive — activate it first");

  // Load connections referenced by nodes (same as execute route)
  const nodes = (workflow.nodes ?? []) as Array<{ data?: { config?: { connectionId?: string } } }>;
  const connectionIds = [...new Set(
    nodes.map((n) => n.data?.config?.connectionId).filter(Boolean) as string[]
  )];
  const connectionsMap: Record<string, Record<string, unknown>> = {};
  if (connectionIds.length > 0) {
    const { data: conns } = await admin
      .from("connections")
      .select("id, config")
      .in("id", connectionIds);
    for (const conn of conns ?? []) {
      connectionsMap[conn.id] = conn.config as Record<string, unknown>;
    }
  }

  // Execute
  const { executeWorkflow } = await import("@/lib/executor");
  const ctx = await executeWorkflow(
    workflow.nodes ?? [],
    workflow.edges ?? [],
    args,
    connectionsMap,
    workflowId,
    orgId
  );

  // Return agent_reply if present, else last node output as JSON
  const agentReply = ctx.nodeOutputs["__agent_reply__"];
  if (agentReply != null) return String(agentReply);

  const outputs = Object.entries(ctx.nodeOutputs).filter(([k]) => k !== "__agent_reply__");
  if (outputs.length > 0) {
    const last = outputs[outputs.length - 1][1];
    return typeof last === "string" ? last : JSON.stringify(last, null, 2);
  }
  return "Workflow executed successfully";
}

/** Log a tool execution to mcp_tool_executions (non-fatal) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logExecution(
  admin: any,
  params: {
    org_id: string;
    server_id: string;
    tool_id: string | null;
    tool_name: string;
    input_data: Record<string, unknown>;
    output_text: string | null;
    status: "success" | "error";
    error_message: string | null;
    duration_ms: number;
    transport: string;
  }
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("mcp_tool_executions").insert(params);
  } catch { /* non-fatal */ }
}

/** Main MCP request dispatcher */
export async function handleMcpRequest(
  rpc: JsonRpcRequest,
  slug: string,
  transport: "sse" | "http" = "sse"
): Promise<JsonRpcResponse | null> {
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const id = rpc.id ?? null;

  // Load server by slug
  const { data: server } = await admin
    .from("mcp_toolboxes")
    .select("id, name, org_id, enabled, type")
    .eq("slug", slug)
    .eq("type", "hosted")
    .single();

  if (!server) return err(id, -32001, "MCP server not found");
  if (!server.enabled) return err(id, -32001, "MCP server is disabled");

  switch (rpc.method) {
    case "initialize": {
      return ok(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: server.name, version: "1.0.0" },
        capabilities: { tools: {} },
      });
    }

    case "notifications/initialized":
    case "ping":
      // No response for notifications; return empty pong for ping
      return rpc.method === "ping" ? ok(id, {}) : null;

    case "tools/list": {
      const { data: tools } = await admin
        .from("mcp_tools")
        .select("name, display_name, description, input_schema")
        .eq("server_id", server.id)
        .eq("org_id", server.org_id)
        .eq("enabled", true)
        .order("created_at", { ascending: true });

      return ok(id, {
        tools: (tools ?? []).map((t) => ({
          name: t.name,
          description: t.description ?? t.display_name ?? t.name,
          inputSchema: t.input_schema ?? { type: "object", properties: {} },
        })),
      });
    }

    case "tools/call": {
      const params = rpc.params as { name: string; arguments?: Record<string, unknown> };
      if (!params?.name) return err(id, -32602, "Missing tool name");

      const { data: tool } = await admin
        .from("mcp_tools")
        .select("id, name, workflow_id, enabled")
        .eq("server_id", server.id)
        .eq("org_id", server.org_id)
        .eq("name", params.name)
        .single();

      if (!tool) return err(id, -32602, `Tool "${params.name}" not found`);
      if (!tool.enabled) return err(id, -32602, `Tool "${params.name}" is disabled`);
      if (!tool.workflow_id) return err(id, -32602, `Tool "${params.name}" has no linked scenario`);

      const startMs = Date.now();
      const inputData = params.arguments ?? {};

      try {
        const text = await runWorkflowForTool(tool.workflow_id, server.org_id, inputData);
        const duration = Date.now() - startMs;
        await logExecution(admin, {
          org_id: server.org_id,
          server_id: server.id,
          tool_id: tool.id,
          tool_name: tool.name,
          input_data: inputData,
          output_text: text,
          status: "success",
          error_message: null,
          duration_ms: duration,
          transport,
        });
        return ok(id, { content: [{ type: "text", text }] });
      } catch (e) {
        const duration = Date.now() - startMs;
        const msg = e instanceof Error ? e.message : String(e);
        await logExecution(admin, {
          org_id: server.org_id,
          server_id: server.id,
          tool_id: tool.id,
          tool_name: tool.name,
          input_data: inputData,
          output_text: null,
          status: "error",
          error_message: msg,
          duration_ms: duration,
          transport,
        });
        return err(id, -32603, msg);
      }
    }

    default:
      return err(id, -32601, `Method not found: ${rpc.method}`);
  }
}
