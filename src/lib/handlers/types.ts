import type { ExecutionContext, WorkflowNode, WorkflowEdge } from "../types";

export interface HandlerCtx {
  config: Record<string, unknown>;
  ctx: ExecutionContext;
  interpolate: (s: string) => string;
  node: WorkflowNode;
  // Passed for recursive nodes (iterator, sub_workflow, agent)
  runSubWorkflow: (
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    triggerData: Record<string, unknown>,
    connections: Record<string, Record<string, unknown>>,
    workflowId?: string,
    orgId?: string
  ) => Promise<ExecutionContext>;
  connections: Record<string, Record<string, unknown>>;
}

export type NodeHandler = (hc: HandlerCtx) => Promise<unknown>;
