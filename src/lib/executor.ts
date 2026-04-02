import type { WorkflowNode, WorkflowEdge, ExecutionLog, ExecutionContext } from "./types";
import { createServerClient } from "./supabase";
import { HANDLERS } from "./handlers/index";
import type { HandlerCtx } from "./handlers/index";

export type { ExecutionContext };

async function executeNodeOnce(
  node: WorkflowNode,
  ctx: ExecutionContext,
  connections: Record<string, Record<string, unknown>>,
  log: ExecutionLog,
  start: number
): Promise<unknown> {
  const { type } = node.data;
    let output: unknown;

    // Merge connection credentials into config if a connectionId is set
    const effectiveConfig: Record<string, unknown> = { ...node.data.config };
    if (node.data.config.connectionId && connections[node.data.config.connectionId as string]) {
      Object.assign(effectiveConfig, connections[node.data.config.connectionId as string]);
    }
    const config = effectiveConfig;

    // ── Shared interpolation helper (available to ALL node cases) ──────────────
    // Resolves {{node_id.field}} and {{secret.NAME}} placeholders.
    const allData: Record<string, unknown> = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interpolate = (str: string): string => {
      if (!str) return str;
      return str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const trimmed = path.trim();
        if (trimmed.startsWith("secret.")) {
          return ctx.secrets[trimmed.slice(7)] ?? "";
        }
        const val = trimmed.split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      });
    };

    // Simple pass-through triggers — return trigger data directly
    const passThroughTriggers = new Set([
      "trigger_manual",
      "trigger_webhook",
      "trigger_schedule",
      "trigger_interval",
      "trigger_github_event",
      "trigger_stripe",
      "trigger_form",
      "trigger_email_inbound",
      "trigger_rss_poll",
      "trigger_agent",
      "trigger_slack_event",
      "trigger_hubspot",
      "trigger_shopify",
      "trigger_jira_event",
      "trigger_calendly",
      "trigger_typeform",
      "trigger_gitlab_event",
      "trigger_paypal_webhook",
      "trigger_discord_event",
      "trigger_telegram_update",
      "trigger_linear_event",
      "trigger_pipedrive",
      "trigger_woocommerce",
      "trigger_clickup",
      "trigger_asana",
      "trigger_zendesk",
      "trigger_intercom",
      "trigger_freshdesk",
      "trigger_square_webhook",
      "trigger_paddle",
      "trigger_tally",
      "trigger_bitbucket_event",
      "trigger_sentry_alert",
      "trigger_pagerduty",
      "trigger_datadog",
    ]);

    if (passThroughTriggers.has(type)) {
      output = ctx.triggerData;
    } else {
      // Build HandlerCtx and dispatch to the appropriate handler
      const hc: HandlerCtx = {
        config,
        ctx,
        interpolate,
        node,
        runSubWorkflow: executeWorkflow,
        connections,
      };
      const handler = HANDLERS[type];
      if (!handler) throw new Error(`Unknown node type: ${type}`);
      output = await handler(hc);
    }

    // Polling triggers return { _skip: true } when nothing new was found — stop execution cleanly
    if (output && typeof output === "object" && (output as Record<string, unknown>)._skip === true) {
      log.status = "success";
      log.output = output;
      log.duration_ms = Date.now() - start;
      ctx.nodeOutputs[node.id] = output;
      return output;
    }

    log.status = "success";
    log.output = output;
    log.duration_ms = Date.now() - start;
    ctx.nodeOutputs[node.id] = output;
    return output;
}

async function executeNode(
  node: WorkflowNode,
  ctx: ExecutionContext,
  connections: Record<string, Record<string, unknown>> = {}
): Promise<unknown> {
  const start = Date.now();
  // Resolve connection into config so the log reflects what actually runs
  const logConfig = { ...node.data.config };
  const connId = node.data.config.connectionId as string | undefined;
  if (connId && connections[connId]) {
    Object.assign(logConfig, connections[connId]);
  }
  const log: ExecutionLog = {
    node_id: node.id,
    node_label: node.data.label,
    status: "running",
    input: logConfig,
  };
  ctx.logs.push(log);

  const maxRetries = Math.max(0, Number(node.data.config.retry_count || 0));
  const retryDelayMs = Math.max(100, Number(node.data.config.retry_delay_ms || 1000));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(retryDelayMs * Math.pow(2, attempt - 1), 30000);
      await new Promise((r) => setTimeout(r, delay));
      log.status = "running";
    }
    try {
      const result = await executeNodeOnce(node, ctx, connections, log, start);
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) continue;
    }
  }

  const error = lastErr instanceof Error ? lastErr.message : String(lastErr);
  log.status = "error";
  log.error = error;
  log.duration_ms = Date.now() - start;
  throw lastErr;
}

function buildExecutionOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  // Topological sort
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const n of nodes) {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  }
  // Skip edges that reference nodes which no longer exist
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  for (const e of validEdges) {
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  }

  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const order: WorkflowNode[] = [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighborId of adj[node.id]) {
      inDegree[neighborId]--;
      if (inDegree[neighborId] === 0) {
        queue.push(nodeMap[neighborId]);
      }
    }
  }

  return order;
}

export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  triggerData: Record<string, unknown> = {},
  connections: Record<string, Record<string, unknown>> = {},
  workflowId?: string,
  orgId?: string
): Promise<ExecutionContext> {
  // Load secrets from Supabase for {{secret.NAME}} interpolation
  let secrets: Record<string, string> = {};
  try {
    const supabase = createServerClient();
    let q = supabase.from("workflow_secrets").select("name, value");
    if (orgId) q = q.eq("org_id", orgId);
    const { data } = await q;
    if (data) secrets = Object.fromEntries(data.map((r: { name: string; value: string }) => [r.name, r.value]));
  } catch { /* secrets table may not exist yet */ }

  const ctx: ExecutionContext = {
    triggerData,
    nodeOutputs: {},
    logs: [],
    workflowId,
    orgId,
    variables: {},
    secrets,
  };

  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  const order = buildExecutionOrder(nodes, edges);

  // Track which branch handle each branching node chose (nodeId → handle id like "true"/"false"/"case_1")
  const branchOutputs: Record<string, string> = {};
  // Track nodes that were skipped due to inactive branch
  const skippedNodes = new Set<string>();

  for (const node of order) {
    // Determine if this node should be skipped
    const incomingEdges = validEdges.filter((e) => e.target === node.id);

    if (incomingEdges.length > 0) {
      const blockedCount = incomingEdges.filter((e) => {
        // Blocked if the source node was itself skipped
        if (skippedNodes.has(e.source)) return true;
        // Blocked if the source is a branching node and this edge's handle doesn't match the chosen branch
        const sourceBranch = branchOutputs[e.source];
        if (sourceBranch !== undefined && e.sourceHandle && e.sourceHandle !== sourceBranch) return true;
        return false;
      }).length;

      if (blockedCount === incomingEdges.length) {
        skippedNodes.add(node.id);
        ctx.logs.push({ node_id: node.id, node_label: node.data.label, status: "skipped" });
        continue;
      }
    }

    try {
      const result = await executeNode(node, ctx, connections);
      // If the node returned a branch decision, record it
      if (result && typeof result === "object" && "_branch" in (result as object)) {
        branchOutputs[node.id] = (result as Record<string, unknown>)._branch as string;
      }
      // Polling trigger found nothing — skip all downstream nodes cleanly
      if (result && typeof result === "object" && (result as Record<string, unknown>)._skip === true) {
        skippedNodes.add(node.id);
      }
    } catch {
      // Node failed — mark it as skipped so all downstream nodes are skipped too
      skippedNodes.add(node.id);
    }
  }

  return ctx;
}
