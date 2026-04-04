import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ─── RAG: embed query + retrieve top chunks ───────────────────────────────────

async function retrieveRelevantChunks(
  agentId: string,
  query: string
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return "";

  // Embed the user's query
  const embRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: query }),
  });
  if (!embRes.ok) return "";
  const embData = await embRes.json() as { data: { embedding: number[] }[] };
  const embedding = embData.data[0]?.embedding;
  if (!embedding) return "";

  // Vector similarity search via Supabase RPC
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    p_agent_id: agentId,
    p_embedding: `[${embedding.join(",")}]`,
    p_limit: 5,
  });
  if (error || !data?.length) return "";

  return (data as { content: string; filename: string; similarity: number }[])
    .map((c) => `[${c.filename}]\n${c.content}`)
    .join("\n\n---\n\n");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type WorkflowParam = {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
};

type ConnectedWorkflow = {
  workflowId: string;
  name: string;
  description: string;
  whenToUse: string;
  enabled: boolean;
  parameters?: WorkflowParam[];
};

function buildToolSchema(wf: ConnectedWorkflow): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  const params = wf.parameters ?? [];
  if (params.length === 0) {
    return {
      type: "object",
      properties: { query: { type: "string", description: "The user's input or context for this workflow" } },
      required: [],
    };
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    if (!p.name) continue;
    properties[p.name] = { type: p.type, description: p.description || p.name };
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, required };
}

type MCPDiscoveredTool = {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  enabled: boolean;
};

type MCPTool = {
  id: string;
  name: string;
  server_url: string;
  auth_key?: string;
  enabled: boolean;
  discovered_tools?: MCPDiscoveredTool[];
};

// Call a tool on an MCP server via JSON-RPC tools/call
async function callMCPTool(
  serverUrl: string,
  authKey: string | undefined,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authKey?.trim()) headers["Authorization"] = `Bearer ${authKey.trim()}`;
  try {
    const res = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `Tool call failed: HTTP ${res.status}`;
    const json = await res.json();
    const content = json?.result?.content;
    if (Array.isArray(content)) {
      return content.map((c: { type: string; text?: string }) => c.text ?? JSON.stringify(c)).filter(Boolean).join("\n") || "No result";
    }
    if (json?.result !== undefined) return typeof json.result === "string" ? json.result : JSON.stringify(json.result);
    if (json?.error) return `MCP error: ${json.error.message ?? JSON.stringify(json.error)}`;
    return "Tool returned no result";
  } catch (err) {
    return `MCP tool error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

// Build LLM tool defs + a name→server lookup from the enabled MCP servers
function buildMCPToolDefs(mcpTools: MCPTool[]): {
  defs: { name: string; description: string; input_schema: Record<string, unknown> }[];
  lookup: Map<string, { serverUrl: string; authKey?: string; originalName: string }>;
} {
  const defs: { name: string; description: string; input_schema: Record<string, unknown> }[] = [];
  const lookup = new Map<string, { serverUrl: string; authKey?: string; originalName: string }>();
  for (let si = 0; si < mcpTools.length; si++) {
    const server = mcpTools[si];
    if (!server.enabled || !server.discovered_tools?.length) continue;
    for (const tool of server.discovered_tools) {
      if (!tool.enabled) continue;
      const safeName = `mcp_${si}_${tool.name.replace(/[^a-z0-9_]/gi, "_")}`;
      defs.push({
        name: safeName,
        description: `[${server.name}] ${tool.description || tool.name}`,
        input_schema: (tool.input_schema ?? { type: "object", properties: {}, required: [] }) as Record<string, unknown>,
      });
      lookup.set(safeName, { serverUrl: server.server_url, authKey: server.auth_key, originalName: tool.name });
    }
  }
  return { defs, lookup };
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function getApiKey(provider: string, agentKey: string): string {
  if (agentKey && agentKey.trim()) return agentKey.trim();
  switch (provider) {
    case "anthropic": return process.env.ANTHROPIC_API_KEY ?? "";
    case "openai": return process.env.OPENAI_API_KEY ?? "";
    case "gemini": return process.env.GOOGLE_API_KEY ?? "";
    case "groq": return process.env.GROQ_API_KEY ?? "";
    case "mistral": return process.env.MISTRAL_API_KEY ?? "";
    default: return "";
  }
}

type BehaviorConfig = {
  temperature_locked?: boolean;
  response_format?: "auto" | "markdown" | "json" | "plain";
  language?: string;
  guardrails?: string[];
  max_response_words?: number;
};

function buildSystemPrompt(
  systemPrompt: string,
  knowledgeBase: string,
  connectedWorkflows: ConnectedWorkflow[],
  provider: string,
  retrievedContext = "",
  behavior: BehaviorConfig = {}
): string {
  let prompt = "";

  // RAG: inject only the semantically relevant chunks for this query
  if (retrievedContext.trim()) {
    prompt += `## Relevant Knowledge\nUse the following retrieved context to answer the user's question. Only use information that is relevant.\n\n${retrievedContext.trim()}\n\n`;
  } else if (knowledgeBase && knowledgeBase.trim()) {
    // Fallback: no embeddings uploaded — use raw text as before
    prompt += `## Knowledge Base\n${knowledgeBase.trim()}\n\n`;
  }

  prompt += systemPrompt;

  // Behavior rules
  const rules: string[] = [];
  if (behavior.response_format === "json") rules.push("You MUST respond with valid JSON only. No prose, no markdown fences.");
  if (behavior.response_format === "plain") rules.push("You MUST respond in plain text only. No markdown formatting.");
  if (behavior.response_format === "markdown") rules.push("You MUST format your response using Markdown.");
  if (behavior.language?.trim()) rules.push(`You MUST always respond in ${behavior.language.trim()}, regardless of the language the user writes in.`);
  if (behavior.max_response_words && behavior.max_response_words > 0) rules.push(`Your response MUST be at most ${behavior.max_response_words} words.`);
  if (behavior.guardrails?.length) {
    rules.push(...behavior.guardrails.map(g => `Rule: ${g}`));
  }
  if (rules.length > 0) {
    prompt += `\n\n## Behavior Rules (MUST follow)\n${rules.map(r => `- ${r}`).join("\n")}`;
  }

  // For non-Anthropic providers, inject workflow info into system prompt
  if (provider !== "anthropic") {
    const enabledWorkflows = connectedWorkflows.filter(w => w.enabled);
    if (enabledWorkflows.length > 0) {
      prompt += "\n\n## Available Workflows\nYou have access to the following workflows:\n";
      for (const wf of enabledWorkflows) {
        prompt += `- **${wf.name}** (ID: ${wf.workflowId}): ${wf.whenToUse || wf.description}\n`;
      }
      prompt +=
        "\nTo invoke a workflow, say 'INVOKE_WORKFLOW:[id]' and the system will handle it. " +
        "Replace [id] with the actual workflow ID.";
    }
  }

  return prompt;
}

// Resolve the public base URL, preferring the env var over the request origin.
// On Railway the request URL can be an internal container address.
function getPublicOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function executeWorkflow(
  workflowId: string,
  args: Record<string, unknown>,
  origin: string
): Promise<string> {
  try {
    const res = await fetch(`${origin}/api/execute/${workflowId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_data: args }),
    });
    if (!res.ok) {
      return `Workflow execution failed with status ${res.status}`;
    }
    const result = await res.json();
    // Prefer explicit agent_reply if the workflow has an Agent Reply node
    if (result.agent_reply !== undefined) {
      return String(result.agent_reply);
    }
    // Fallback: summarise the execution outcome
    return `Workflow completed with status: ${result.status ?? "unknown"}`;
  } catch (err) {
    return `Failed to execute workflow: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

// ─── Anthropic streaming with tool_use support ────────────────────────────────

async function streamAnthropic(
  chatbot: {
    model: string;
    temperature: number;
    max_tokens: number;
    api_key: string;
    system_prompt: string;
    knowledge_base: string;
    connected_workflows: ConnectedWorkflow[];
    mcp_tools?: MCPTool[];
    _retrievedContext?: string;
    behavior?: BehaviorConfig;
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("anthropic", chatbot.api_key);
  if (!apiKey) throw new Error("No Anthropic API key configured");

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const behavior = chatbot.behavior ?? {};
  const connectedWorkflows: ConnectedWorkflow[] = chatbot.connected_workflows ?? [];
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    connectedWorkflows,
    "anthropic",
    chatbot._retrievedContext,
    behavior
  );

  const enabledWorkflows = connectedWorkflows.filter(w => w.enabled);
  const { defs: mcpDefs, lookup: mcpLookup } = buildMCPToolDefs(chatbot.mcp_tools ?? []);

  const tools: import("@anthropic-ai/sdk/resources").Tool[] = [
    ...enabledWorkflows.map(wf => ({
      name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
      description: wf.whenToUse || wf.description || `Invoke the "${wf.name}" workflow`,
      input_schema: buildToolSchema(wf) as import("@anthropic-ai/sdk/resources").Tool["input_schema"],
    })),
    ...mcpDefs.map(d => ({
      name: d.name,
      description: d.description,
      input_schema: d.input_schema as import("@anthropic-ai/sdk/resources").Tool["input_schema"],
    })),
  ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages] as import("@anthropic-ai/sdk/resources").MessageParam[];

        // Agentic loop: keep running until no more tool_use
        while (true) {
          const requestParams: import("@anthropic-ai/sdk/resources").MessageCreateParamsStreaming = {
            model: chatbot.model ?? "claude-haiku-4-5-20251001",
            max_tokens: chatbot.max_tokens ?? 1024,
            temperature: behavior.temperature_locked ? 0 : (chatbot.temperature ?? 0.7),
            system: systemPrompt,
            messages: currentMessages,
            stream: true,
            ...(tools.length > 0 ? { tools } : {}),
          };

          const stream = await client.messages.create(requestParams);

          let accumulatedText = "";
          let stopReason: string | null = null;
          const toolUseBlocks: { id: string; name: string; input: Record<string, unknown> }[] = [];
          let currentToolId = "";
          let currentToolName = "";
          let currentToolInputJson = "";

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              currentToolId = event.content_block.id;
              currentToolName = event.content_block.name;
              currentToolInputJson = "";
            }

            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              accumulatedText += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }

            if (
              event.type === "content_block_delta" &&
              event.delta.type === "input_json_delta"
            ) {
              currentToolInputJson += event.delta.partial_json;
            }

            if (event.type === "content_block_stop") {
              if (currentToolId && currentToolName) {
                let parsedInput: Record<string, unknown> = {};
                try {
                  parsedInput = JSON.parse(currentToolInputJson || "{}");
                } catch {
                  parsedInput = {};
                }
                toolUseBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                });
                currentToolId = "";
                currentToolName = "";
                currentToolInputJson = "";
              }
            }

            if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason ?? null;
            }
          }

          if (stopReason !== "tool_use" || toolUseBlocks.length === 0) {
            // No more tools to call — done
            break;
          }

          // Notify client tools are being invoked
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "\n\n*Invoking connected workflow...*\n\n" })}\n\n`)
          );

          // Build assistant message with tool_use blocks using Param types (no citations/caller required)
          const assistantContent: import("@anthropic-ai/sdk/resources").ContentBlockParam[] = [];
          if (accumulatedText) {
            assistantContent.push({ type: "text", text: accumulatedText });
          }
          for (const tb of toolUseBlocks) {
            assistantContent.push({
              type: "tool_use",
              id: tb.id,
              name: tb.name,
              input: tb.input,
            });
          }

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: assistantContent },
          ] as import("@anthropic-ai/sdk/resources").MessageParam[];

          // Execute each tool — workflow or MCP
          const toolResults: import("@anthropic-ai/sdk/resources").ToolResultBlockParam[] = [];
          for (const tb of toolUseBlocks) {
            let result: string;
            if (mcpLookup.has(tb.name)) {
              const { serverUrl, authKey, originalName } = mcpLookup.get(tb.name)!;
              result = await callMCPTool(serverUrl, authKey, originalName, tb.input);
            } else {
              const workflowId = tb.name.replace(/^workflow_/, "").replace(/_/g, "-");
              result = await executeWorkflow(workflowId, tb.input, origin);
            }
            toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: result });
          }

          currentMessages = [
            ...currentMessages,
            { role: "user", content: toolResults },
          ] as import("@anthropic-ai/sdk/resources").MessageParam[];
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── OpenAI streaming with native function calling ────────────────────────────

async function streamOpenAI(
  chatbot: {
    model: string;
    temperature: number;
    max_tokens: number;
    api_key: string;
    system_prompt: string;
    knowledge_base: string;
    connected_workflows: ConnectedWorkflow[];
    mcp_tools?: MCPTool[];
    _retrievedContext?: string;
    behavior?: BehaviorConfig;
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("openai", chatbot.api_key);
  if (!apiKey) throw new Error("No OpenAI API key configured");

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });

  const behavior = chatbot.behavior ?? {};
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    [],
    "openai",
    chatbot._retrievedContext,
    behavior
  );

  type OAIMessage = import("openai/resources").ChatCompletionMessageParam;

  const enabledWorkflows = (chatbot.connected_workflows ?? []).filter(w => w.enabled);
  const { defs: mcpDefs, lookup: mcpLookup } = buildMCPToolDefs(chatbot.mcp_tools ?? []);

  const tools: import("openai/resources").ChatCompletionTool[] = [
    ...enabledWorkflows.map(wf => ({
      type: "function" as const,
      function: {
        name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
        description: wf.whenToUse || wf.description || `Invoke the "${wf.name}" workflow`,
        parameters: buildToolSchema(wf),
      },
    })),
    ...mcpDefs.map(d => ({
      type: "function" as const,
      function: { name: d.name, description: d.description, parameters: d.input_schema },
    })),
  ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let currentMessages: OAIMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        // Agentic loop — keep running until no more tool calls
        while (true) {
          const stream = await client.chat.completions.create({
            model: chatbot.model ?? "gpt-4o-mini",
            max_tokens: chatbot.max_tokens ?? 1024,
            temperature: behavior.temperature_locked ? 0 : (chatbot.temperature ?? 0.7),
            messages: currentMessages,
            stream: true,
            ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
          });

          let accText = "";
          let finishReason = "";
          // Map from tool_call index → accumulated call data
          const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            finishReason = choice.finish_reason ?? finishReason;
            const delta = choice.delta;

            // Stream text tokens to client
            if (delta?.content) {
              accText += delta.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
              );
            }

            // Accumulate tool call deltas
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallsMap[idx]) {
                  toolCallsMap[idx] = { id: "", name: "", arguments: "" };
                }
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
              }
            }
          }

          const toolCalls = Object.values(toolCallsMap);

          // No tool calls — we're done
          if (finishReason !== "tool_calls" || toolCalls.length === 0) break;

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "\n\n*Looking up information...*\n\n" })}\n\n`)
          );

          // Add assistant message with tool_calls to history
          currentMessages.push({
            role: "assistant",
            content: accText || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });

          // Execute each tool — workflow or MCP
          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments || "{}"); } catch { /**/ }
            let result: string;
            if (mcpLookup.has(tc.name)) {
              const { serverUrl, authKey, originalName } = mcpLookup.get(tc.name)!;
              result = await callMCPTool(serverUrl, authKey, originalName, args);
            } else {
              const workflowId = tc.name.replace(/^workflow_/, "").replace(/_/g, "-");
              result = await executeWorkflow(workflowId, args, origin);
            }
            currentMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Groq streaming with native function calling (OpenAI-compatible) ─────────

async function streamGroq(
  chatbot: {
    model: string;
    temperature: number;
    max_tokens: number;
    api_key: string;
    system_prompt: string;
    knowledge_base: string;
    connected_workflows: ConnectedWorkflow[];
    mcp_tools?: MCPTool[];
    _retrievedContext?: string;
    behavior?: BehaviorConfig;
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("groq", chatbot.api_key);
  if (!apiKey) throw new Error("No Groq API key configured");

  const Groq = (await import("groq-sdk")).default;
  const client = new Groq({ apiKey });

  const behavior = chatbot.behavior ?? {};
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    [],
    "groq",
    chatbot._retrievedContext,
    behavior
  );

  type GroqMessage = import("groq-sdk/resources/chat/completions").ChatCompletionMessageParam;

  const enabledWorkflows = (chatbot.connected_workflows ?? []).filter(w => w.enabled);
  const { defs: mcpDefs, lookup: mcpLookup } = buildMCPToolDefs(chatbot.mcp_tools ?? []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    ...enabledWorkflows.map(wf => ({
      type: "function",
      function: {
        name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
        description: wf.whenToUse || wf.description || `Invoke the "${wf.name}" workflow`,
        parameters: buildToolSchema(wf),
      },
    })),
    ...mcpDefs.map(d => ({
      type: "function",
      function: { name: d.name, description: d.description, parameters: d.input_schema },
    })),
  ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let currentMessages: GroqMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        while (true) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stream = await client.chat.completions.create({
            model: chatbot.model ?? "llama-3.1-8b-instant",
            max_tokens: chatbot.max_tokens ?? 1024,
            temperature: behavior.temperature_locked ? 0 : (chatbot.temperature ?? 0.7),
            messages: currentMessages,
            stream: true as const,
            ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
          } as Parameters<typeof client.chat.completions.create>[0]) as AsyncIterable<import("groq-sdk/resources/chat/completions").ChatCompletionChunk>;

          let accText = "";
          let finishReason = "";
          const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            finishReason = choice.finish_reason ?? finishReason;
            const delta = choice.delta as Record<string, unknown>;

            if (typeof delta?.content === "string") {
              accText += delta.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
              );
            }

            const tcs = delta?.tool_calls as Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> | undefined;
            if (tcs) {
              for (const tc of tcs) {
                const idx = tc.index ?? 0;
                if (!toolCallsMap[idx]) toolCallsMap[idx] = { id: "", name: "", arguments: "" };
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
              }
            }
          }

          const toolCalls = Object.values(toolCallsMap);
          if (finishReason !== "tool_calls" || toolCalls.length === 0) break;

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "\n\n*Looking up information...*\n\n" })}\n\n`)
          );

          (currentMessages as unknown[]).push({
            role: "assistant",
            content: accText || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });

          for (const tc of toolCalls) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments || "{}"); } catch { /**/ }
            let result: string;
            if (mcpLookup.has(tc.name)) {
              const { serverUrl, authKey, originalName } = mcpLookup.get(tc.name)!;
              result = await callMCPTool(serverUrl, authKey, originalName, args);
            } else {
              const workflowId = tc.name.replace(/^workflow_/, "").replace(/_/g, "-");
              result = await executeWorkflow(workflowId, args, origin);
            }
            (currentMessages as unknown[]).push({ role: "tool", tool_call_id: tc.id, content: result });
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Google Gemini streaming ───────────────────────────────────────────────────

async function streamGemini(
  chatbot: {
    model: string;
    temperature: number;
    max_tokens: number;
    api_key: string;
    system_prompt: string;
    knowledge_base: string;
    connected_workflows: ConnectedWorkflow[];
    _retrievedContext?: string;
    behavior?: BehaviorConfig;
  },
  messages: ChatMessage[]
): Promise<ReadableStream> {
  const apiKey = getApiKey("gemini", chatbot.api_key);
  if (!apiKey) throw new Error("No Google API key configured");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  const behavior = chatbot.behavior ?? {};
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    chatbot.connected_workflows ?? [],
    "gemini",
    chatbot._retrievedContext,
    behavior
  );

  const GEMINI_ALIASES: Record<string, string> = {
    "gemini-1.5-flash": "gemini-2.0-flash",
    "gemini-1.5-pro": "gemini-2.0-flash",
    "gemini-pro": "gemini-2.0-flash",
  };
  const rawGeminiModel = chatbot.model ?? "gemini-2.0-flash";
  const resolvedGeminiModel = GEMINI_ALIASES[rawGeminiModel] ?? rawGeminiModel;

  const model = genAI.getGenerativeModel({
    model: resolvedGeminiModel,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: chatbot.max_tokens ?? 1024,
      temperature: behavior.temperature_locked ? 0 : (chatbot.temperature ?? 0.7),
    },
  });

  // Convert to Gemini history format
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage?.content ?? "");

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Mistral streaming ────────────────────────────────────────────────────────

async function streamMistral(
  chatbot: {
    model: string;
    temperature: number;
    max_tokens: number;
    api_key: string;
    system_prompt: string;
    knowledge_base: string;
    connected_workflows: ConnectedWorkflow[];
    _retrievedContext?: string;
    behavior?: BehaviorConfig;
  },
  messages: ChatMessage[]
): Promise<ReadableStream> {
  const apiKey = getApiKey("mistral", chatbot.api_key);
  if (!apiKey) throw new Error("No Mistral API key configured");

  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey });

  const behavior = chatbot.behavior ?? {};
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    chatbot.connected_workflows ?? [],
    "mistral",
    chatbot._retrievedContext,
    behavior
  );

  const mistralMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const stream = await client.chat.stream({
    model: chatbot.model ?? "mistral-small-latest",
    maxTokens: chatbot.max_tokens ?? 1024,
    temperature: behavior.temperature_locked ? 0 : (chatbot.temperature ?? 0.7),
    messages: mistralMessages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.data?.choices?.[0]?.delta?.content;
          if (delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
            );
          }
          if (chunk.data?.choices?.[0]?.finishReason === "stop") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: chatbot, error } = await supabase
    .from("chatbots")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !chatbot) {
    return new Response(JSON.stringify({ error: "Chatbot not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  // ── Simple bot: pure intent matching, no LLM ─────────────────────────────
  if (chatbot.agent_type === "simple") {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const input = (lastUserMsg?.content ?? "").toLowerCase().trim();

    type IntentRow = { name: string; triggers: string; response: string };
    const intents: IntentRow[] = chatbot.intents ?? [];
    const fallback: string =
      chatbot.appearance?.fallbackMessage ??
      "Sorry, I didn't understand that. Could you rephrase?";

    let reply = fallback;
    for (const intent of intents) {
      const keywords = intent.triggers
        .split(",")
        .map((k: string) => k.trim().toLowerCase())
        .filter(Boolean);
      if (keywords.some((kw: string) => input.includes(kw))) {
        reply = intent.response;
        break;
      }
    }

    // Stream reply as SSE to match what the embed page expects
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text_delta", text: reply })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  }

  const origin = getPublicOrigin(req);
  const provider: string = chatbot.provider ?? "anthropic";

  // RAG: retrieve relevant knowledge chunks for the latest user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  const retrievedContext = lastUserMsg
    ? await retrieveRelevantChunks(id, lastUserMsg.content).catch(() => "")
    : "";

  // Inject retrieved context into chatbot object so stream functions can use it
  const chatbotWithContext = { ...chatbot, _retrievedContext: retrievedContext };

  try {
    let stream: ReadableStream;

    switch (provider) {
      case "openai":
        stream = await streamOpenAI(chatbotWithContext, messages, origin);
        break;
      case "groq":
        stream = await streamGroq(chatbotWithContext, messages, origin);
        break;
      case "gemini":
        stream = await streamGemini(chatbotWithContext, messages);
        break;
      case "mistral":
        stream = await streamMistral(chatbotWithContext, messages);
        break;
      case "anthropic":
      default:
        stream = await streamAnthropic(chatbotWithContext, messages, origin);
        break;
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}
