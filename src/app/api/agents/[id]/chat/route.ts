import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type ConnectedWorkflow = {
  workflowId: string;
  name: string;
  description: string;
  whenToUse: string;
  enabled: boolean;
};

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

function buildSystemPrompt(
  systemPrompt: string,
  knowledgeBase: string,
  connectedWorkflows: ConnectedWorkflow[],
  provider: string
): string {
  let prompt = "";

  if (knowledgeBase && knowledgeBase.trim()) {
    prompt += `## Knowledge Base\n${knowledgeBase.trim()}\n\n`;
  }

  prompt += systemPrompt;

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
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("anthropic", chatbot.api_key);
  if (!apiKey) throw new Error("No Anthropic API key configured");

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    chatbot.connected_workflows,
    "anthropic"
  );

  const enabledWorkflows = chatbot.connected_workflows.filter(w => w.enabled);

  const tools: import("@anthropic-ai/sdk/resources").Tool[] = enabledWorkflows.map(wf => ({
    name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
    description: wf.whenToUse || wf.description || wf.name,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The user's query or context for this workflow" },
      },
      required: [],
    },
  }));

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
            temperature: chatbot.temperature ?? 0.7,
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

          // Execute each workflow tool and collect results
          const toolResults: import("@anthropic-ai/sdk/resources").ToolResultBlockParam[] = [];
          for (const tb of toolUseBlocks) {
            // Extract workflowId from tool name: workflow_<uuid_with_underscores>
            const workflowId = tb.name.replace(/^workflow_/, "").replace(/_/g, "-");
            const result = await executeWorkflow(workflowId, tb.input, origin);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tb.id,
              content: result,
            });
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
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("openai", chatbot.api_key);
  if (!apiKey) throw new Error("No OpenAI API key configured");

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });

  // Use clean system prompt without INVOKE_WORKFLOW injection
  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    [],   // pass empty — tools are declared natively below
    "openai"
  );

  type OAIMessage = import("openai/resources").ChatCompletionMessageParam;

  const enabledWorkflows = chatbot.connected_workflows.filter(w => w.enabled);

  const tools: import("openai/resources").ChatCompletionTool[] = enabledWorkflows.map(wf => ({
    type: "function" as const,
    function: {
      name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
      description: wf.whenToUse || wf.description || wf.name,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The user input or context to pass to this workflow" },
        },
        required: [],
      },
    },
  }));

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
            temperature: chatbot.temperature ?? 0.7,
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

          // Execute each workflow and append tool results
          for (const tc of toolCalls) {
            const workflowId = tc.name.replace(/^workflow_/, "").replace(/_/g, "-");
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments || "{}"); } catch { /**/ }
            const result = await executeWorkflow(workflowId, args, origin);
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
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
  },
  messages: ChatMessage[],
  origin: string
): Promise<ReadableStream> {
  const apiKey = getApiKey("groq", chatbot.api_key);
  if (!apiKey) throw new Error("No Groq API key configured");

  const Groq = (await import("groq-sdk")).default;
  const client = new Groq({ apiKey });

  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    [],
    "groq"
  );

  type GroqMessage = import("groq-sdk/resources/chat/completions").ChatCompletionMessageParam;

  const enabledWorkflows = chatbot.connected_workflows.filter(w => w.enabled);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = enabledWorkflows.map(wf => ({
    type: "function",
    function: {
      name: `workflow_${wf.workflowId.replace(/-/g, "_")}`,
      description: wf.whenToUse || wf.description || wf.name,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The user input or context to pass to this workflow" },
        },
        required: [],
      },
    },
  }));

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
            temperature: chatbot.temperature ?? 0.7,
            messages: currentMessages,
            stream: true,
            ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
          } as Parameters<typeof client.chat.completions.create>[0]);

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
            const workflowId = tc.name.replace(/^workflow_/, "").replace(/_/g, "-");
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments || "{}"); } catch { /**/ }
            const result = await executeWorkflow(workflowId, args, origin);
            (currentMessages as unknown[]).push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
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
  },
  messages: ChatMessage[]
): Promise<ReadableStream> {
  const apiKey = getApiKey("gemini", chatbot.api_key);
  if (!apiKey) throw new Error("No Google API key configured");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    chatbot.connected_workflows,
    "gemini"
  );

  const model = genAI.getGenerativeModel({
    model: chatbot.model ?? "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: chatbot.max_tokens ?? 1024,
      temperature: chatbot.temperature ?? 0.7,
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
  },
  messages: ChatMessage[]
): Promise<ReadableStream> {
  const apiKey = getApiKey("mistral", chatbot.api_key);
  if (!apiKey) throw new Error("No Mistral API key configured");

  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey });

  const systemPrompt = buildSystemPrompt(
    chatbot.system_prompt,
    chatbot.knowledge_base,
    chatbot.connected_workflows,
    "mistral"
  );

  const mistralMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const stream = await client.chat.stream({
    model: chatbot.model ?? "mistral-small-latest",
    maxTokens: chatbot.max_tokens ?? 1024,
    temperature: chatbot.temperature ?? 0.7,
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

  const origin = new URL(req.url).origin;
  const provider: string = chatbot.provider ?? "anthropic";

  try {
    let stream: ReadableStream;

    switch (provider) {
      case "openai":
        stream = await streamOpenAI(chatbot, messages, origin);
        break;
      case "groq":
        stream = await streamGroq(chatbot, messages, origin);
        break;
      case "gemini":
        stream = await streamGemini(chatbot, messages);
        break;
      case "mistral":
        stream = await streamMistral(chatbot, messages);
        break;
      case "anthropic":
      default:
        stream = await streamAnthropic(chatbot, messages, origin);
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
