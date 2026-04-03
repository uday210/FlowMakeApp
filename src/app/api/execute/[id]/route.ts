import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
import { executeWorkflow } from "@/lib/executor";
import { logAudit } from "@/lib/audit";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Fetch workflow
  const { data: workflow, error: wfError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (wfError || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Unwrap trigger_data if the caller sent { trigger_data: {...} }
  // (e.g. agent chat route sends args wrapped in trigger_data key)
  const body = await request.json().catch(() => ({}));
  const triggerData = body.trigger_data !== undefined ? body.trigger_data : body;

  // Collect all connectionIds referenced in this workflow's nodes
  const nodes = workflow.nodes as WorkflowNode[];
  const connectionIds = [...new Set(
    nodes
      .map((n) => n.data?.config?.connectionId as string | undefined)
      .filter(Boolean) as string[]
  )];

  // Fetch referenced connections
  const connectionsMap: Record<string, Record<string, unknown>> = {};
  if (connectionIds.length > 0) {
    const { data: conns } = await supabase
      .from("connections")
      .select("id, config")
      .in("id", connectionIds);
    for (const conn of conns ?? []) {
      connectionsMap[conn.id] = conn.config as Record<string, unknown>;
    }
  }

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from("executions")
    .insert({
      workflow_id: id,
      status: "running",
      trigger_data: triggerData,
      logs: [],
    })
    .select()
    .single();

  if (execError || !execution) {
    return NextResponse.json({ error: "Failed to create execution" }, { status: 500 });
  }

  // Run the workflow
  let finalStatus: "success" | "failed" = "success";
  let ctx;
  try {
    ctx = await executeWorkflow(
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[],
      triggerData,
      connectionsMap,
      id,
      workflow.org_id as string | undefined
    );
    const hasError = ctx.logs.some((l) => l.status === "error");
    if (hasError) finalStatus = "failed";
  } catch {
    finalStatus = "failed";
    ctx = { logs: [] };
  }

  // Update execution record
  await supabase
    .from("executions")
    .update({
      status: finalStatus,
      logs: ctx.logs,
      finished_at: new Date().toISOString(),
    })
    .eq("id", execution.id);

  const successNodes = ctx.logs.filter((l) => l.status === "success").length;
  const errorNodes = ctx.logs.filter((l) => l.status === "error").length;
  const skippedNodes = ctx.logs.filter((l) => l.status === "skipped").length;
  const errorDetails = ctx.logs
    .filter((l) => l.status === "error")
    .map((l) => ({ node: l.node_label, error: l.error }));

  await logAudit({
    supabase, orgId: workflow.org_id as string,
    action: "execution.triggered", resourceType: "execution",
    resourceId: execution.id,
    meta: {
      workflow_id: id,
      workflow_name: workflow.name,
      status: finalStatus,
      nodes_total: ctx.logs.length,
      nodes_success: successNodes,
      nodes_error: errorNodes,
      nodes_skipped: skippedNodes,
      errors: errorDetails.length > 0 ? errorDetails : undefined,
    },
  });

  // Surface agent_reply if present so the calling agent gets a clean text response
  const agentReply = (ctx as { nodeOutputs?: Record<string, unknown> }).nodeOutputs?.["__agent_reply__"];

  return NextResponse.json({
    execution_id: execution.id,
    status: finalStatus,
    logs: ctx.logs,
    ...(agentReply !== undefined ? { agent_reply: agentReply } : {}),
  });
}
