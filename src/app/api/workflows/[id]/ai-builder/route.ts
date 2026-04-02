import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOrgContext } from "@/lib/auth";
import { NODE_DEFINITIONS } from "@/lib/nodeDefinitions";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WFNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; type: string; config: Record<string, unknown> };
}

interface WFEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

// ─── Node catalogue summary (for system prompt) ───────────────────────────────

const TRIGGERS = NODE_DEFINITIONS.filter(n => n.category === "trigger")
  .map(n => `${n.type}: ${n.label} — ${n.description}`)
  .join("\n");

const ACTIONS = NODE_DEFINITIONS.filter(n => n.category === "action")
  .map(n => `${n.type}: ${n.label} — ${n.description}`)
  .join("\n");

// ─── AG-UI event emitter ──────────────────────────────────────────────────────

function makeEmitter(controller: ReadableStreamDefaultController) {
  const enc = new TextEncoder();
  return (event: Record<string, unknown>) => {
    controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}

// ─── Auto-position new node ───────────────────────────────────────────────────

function nextPosition(nodes: WFNode[], isFirst: boolean): { x: number; y: number } {
  if (isFirst || nodes.length === 0) return { x: 100, y: 300 };
  const maxX = Math.max(...nodes.map(n => n.position.x));
  const avgY = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length;
  return { x: maxX + 260, y: Math.round(avgY) };
}

// ─── Tool execution ───────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

interface ToolResult {
  content: string;
  delta?: {
    nodes?: { add?: WFNode[]; remove?: string[]; update?: Partial<WFNode>[] };
    edges?: { add?: WFEdge[]; remove?: string[] };
  };
}

function executeTool(
  name: string,
  input: ToolInput,
  nodes: WFNode[],
  edges: WFEdge[]
): ToolResult {
  switch (name) {
    case "add_node": {
      const nodeType = input.type as string;
      const def = NODE_DEFINITIONS.find(d => d.type === nodeType);
      if (!def) return { content: `Unknown node type: ${nodeType}` };

      const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const position = nextPosition(nodes, nodes.length === 0);
      const node: WFNode = {
        id,
        type: "workflowNode",
        position,
        data: {
          label: (input.label as string) || def.label,
          type: nodeType,
          config: { ...def.defaultConfig, ...(input.config as Record<string, unknown> ?? {}) },
        },
      };
      nodes.push(node);
      return {
        content: `Added node "${node.data.label}" with id "${id}"`,
        delta: { nodes: { add: [node] } },
      };
    }

    case "connect_nodes": {
      const source = input.source_id as string;
      const target = input.target_id as string;
      const sourceNode = nodes.find(n => n.id === source);
      const targetNode = nodes.find(n => n.id === target);
      if (!sourceNode) return { content: `Source node "${source}" not found` };
      if (!targetNode) return { content: `Target node "${target}" not found` };

      const id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const edge: WFEdge = {
        id,
        source,
        target,
        sourceHandle: (input.source_handle as string) || null,
        targetHandle: null,
      };
      edges.push(edge);
      return {
        content: `Connected "${sourceNode.data.label}" → "${targetNode.data.label}"`,
        delta: { edges: { add: [edge] } },
      };
    }

    case "remove_node": {
      const nodeId = input.node_id as string;
      const idx = nodes.findIndex(n => n.id === nodeId);
      if (idx === -1) return { content: `Node "${nodeId}" not found` };
      const label = nodes[idx].data.label;
      nodes.splice(idx, 1);
      // Remove connected edges
      const removedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId).map(e => e.id);
      removedEdges.forEach(eid => { const i = edges.findIndex(e => e.id === eid); if (i !== -1) edges.splice(i, 1); });
      return {
        content: `Removed node "${label}" and ${removedEdges.length} connected edge(s)`,
        delta: { nodes: { remove: [nodeId] }, edges: { remove: removedEdges } },
      };
    }

    case "configure_node": {
      const nodeId = input.node_id as string;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return { content: `Node "${nodeId}" not found` };
      if (input.config) node.data.config = { ...node.data.config, ...(input.config as Record<string, unknown>) };
      if (input.label) node.data.label = input.label as string;
      return {
        content: `Configured node "${node.data.label}"`,
        delta: { nodes: { update: [{ id: nodeId, data: { label: node.data.label, type: node.data.type, config: node.data.config } }] } },
      };
    }

    case "clear_workflow": {
      nodes.splice(0, nodes.length);
      edges.splice(0, edges.length);
      return {
        content: "Cleared all nodes and edges",
        delta: { nodes: { add: [], remove: [], update: [] }, edges: { add: [], remove: [] } },
      };
    }

    default:
      return { content: `Unknown tool: ${name}` };
  }
}

// ─── Claude tools schema ──────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_node",
    description: "Add a new node to the workflow canvas. Call this once per node you want to add. Remember the returned node id for connecting.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Node type from the available list (e.g. 'trigger_webhook', 'action_slack', 'action_openai')" },
        label: { type: "string", description: "Optional display label override for the node" },
        config: { type: "object", description: "Initial config key-values for the node (optional)" },
      },
      required: ["type"],
    },
  },
  {
    name: "connect_nodes",
    description: "Draw an edge (arrow) between two nodes. Use source_handle for branching nodes: 'true'/'false' for if_else, 'case_1'..'case_4'/'default' for switch.",
    input_schema: {
      type: "object" as const,
      properties: {
        source_id: { type: "string", description: "ID of the source (upstream) node" },
        target_id: { type: "string", description: "ID of the target (downstream) node" },
        source_handle: { type: "string", description: "Optional: handle name for branching nodes" },
      },
      required: ["source_id", "target_id"],
    },
  },
  {
    name: "remove_node",
    description: "Remove a node and all its connected edges from the workflow",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the node to remove" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "configure_node",
    description: "Update the config or label of an existing node",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the node to configure" },
        label: { type: "string", description: "New display label (optional)" },
        config: { type: "object", description: "Config fields to set/update (merged with existing)" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "clear_workflow",
    description: "Remove ALL nodes and edges. Use before rebuilding from scratch.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    nodes: WFNode[];
    edges: WFEdge[];
  };

  // Mutable copies we mutate as tools execute
  const nodes: WFNode[] = (body.nodes ?? []).map(n => ({ ...n }));
  const edges: WFEdge[] = (body.edges ?? []).map(e => ({ ...e }));
  const messages: Anthropic.MessageParam[] = body.messages ?? [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });

  const anthropic = new Anthropic({ apiKey });

  const SYSTEM = `You are an expert workflow automation builder for FlowMake (a Make.com-style platform).
Your job: when the user describes what they want to automate, build it on the canvas by calling the provided tools.

RULES:
- Always start with a TRIGGER node (category: trigger), then chain ACTION nodes.
- After adding nodes, connect them in order using connect_nodes.
- Build the full workflow, then briefly describe what you built.
- If the user asks to modify an existing workflow, only change what's needed — don't clear and rebuild unless asked.
- Keep explanations short and focused.

CURRENT WORKFLOW STATE:
Nodes (${nodes.length}): ${nodes.length === 0 ? "empty" : nodes.map(n => `[${n.id}] ${n.data.label} (${n.data.type})`).join(", ")}
Edges (${edges.length}): ${edges.length === 0 ? "none" : edges.map(e => `${e.source} → ${e.target}`).join(", ")}

AVAILABLE TRIGGERS:
${TRIGGERS}

AVAILABLE ACTIONS:
${ACTIONS}`;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = makeEmitter(controller);
      const runId = crypto.randomUUID();

      emit({ type: "RUN_STARTED", runId });

      try {
        let iteration = 0;
        const MAX_ITER = 8;
        const history: Anthropic.MessageParam[] = [...messages];

        while (iteration < MAX_ITER) {
          iteration++;

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: SYSTEM,
            tools: TOOLS,
            messages: history,
          });

          const msgId = crypto.randomUUID();
          let hasText = false;

          // Stream text content
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              if (!hasText) {
                emit({ type: "TEXT_MESSAGE_START", messageId: msgId, role: "assistant" });
                hasText = true;
              }
              // Stream word by word for a nice effect
              const words = block.text.split(" ");
              for (const word of words) {
                emit({ type: "TEXT_MESSAGE_CONTENT", messageId: msgId, delta: word + " " });
              }
            }
          }

          if (hasText) {
            emit({ type: "TEXT_MESSAGE_END", messageId: msgId });
          }

          // Process tool calls
          const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];

          if (toolUseBlocks.length > 0) {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const tool of toolUseBlocks) {
              emit({ type: "TOOL_CALL_START", toolCallId: tool.id, toolName: tool.name });

              const result = executeTool(tool.name, tool.input as ToolInput, nodes, edges);

              if (result.delta) {
                emit({ type: "STATE_DELTA", delta: result.delta });
              }

              emit({ type: "TOOL_CALL_END", toolCallId: tool.id, toolName: tool.name, result: result.content });

              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: result.content,
              });
            }

            // Continue the conversation with tool results
            history.push({ role: "assistant", content: response.content });
            history.push({ role: "user", content: toolResults });
          }

          if (response.stop_reason === "end_turn") break;
          if (response.stop_reason !== "tool_use") break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit({ type: "RUN_ERROR", error: msg });
      }

      emit({ type: "RUN_FINISHED" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
