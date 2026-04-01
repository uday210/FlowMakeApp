import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_openai": async ({ config, ctx, interpolate }) => {
    const oaApiKey = (String(config.api_key || "").trim()) || process.env.OPENAI_API_KEY || "";
    if (!oaApiKey) throw new Error("OpenAI API key is required (set it on the node or via OPENAI_API_KEY env var)");
    const oaAction = (config.action as string) || "chat_completion";
    const oaHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${oaApiKey}` };

    if (oaAction === "chat_completion") {
      const model = (config.model as string) || "gpt-4o-mini";
      const prompt = interpolate(config.prompt as string);
      const system = interpolate((config.system as string) || "");
      if (!prompt) throw new Error("Prompt is required");
      const messages: { role: string; content: string }[] = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });
      const oaBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: config.max_tokens ? Number(config.max_tokens) : 1024,
        temperature: config.temperature !== undefined ? Number(config.temperature) : 0.7,
      };
      if (String(config.json_mode) === "true") oaBody.response_format = { type: "json_object" };
      const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: oaHeaders, body: JSON.stringify(oaBody) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
      const reply = data.choices?.[0]?.message?.content ?? "";
      let parsed: unknown = reply;
      if (String(config.json_mode) === "true") { try { parsed = JSON.parse(reply); } catch { /* keep raw */ } }
      return { reply, parsed, model, usage: data.usage };
    } else if (oaAction === "embeddings") {
      const inputText = interpolate(config.prompt as string || config.input_text as string || "");
      if (!inputText) throw new Error("Input text (prompt field) is required");
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST", headers: oaHeaders,
        body: JSON.stringify({ model: "text-embedding-3-small", input: inputText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
      return { embedding: data.data?.[0]?.embedding, dimensions: data.data?.[0]?.embedding?.length, usage: data.usage };
    } else if (oaAction === "moderation") {
      const inputText = interpolate(config.prompt as string || "");
      if (!inputText) throw new Error("Input text (prompt field) is required");
      const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST", headers: oaHeaders,
        body: JSON.stringify({ input: inputText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
      const result = data.results?.[0];
      return { flagged: result?.flagged, categories: result?.categories, category_scores: result?.category_scores };
    } else if (oaAction === "transcription") {
      const audioUrl = config.audio_url as string;
      if (!audioUrl) throw new Error("Audio URL is required");
      // Fetch the audio file then send to Whisper
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`Could not fetch audio file: ${audioRes.status}`);
      const audioBlob = await audioRes.blob();
      const form = new FormData();
      form.append("file", audioBlob, "audio.mp3");
      form.append("model", "whisper-1");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${oaApiKey}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
      return { text: data.text, language: data.language };
    }
    return undefined;
  },

  "action_claude": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const model = (config.model as string) || "claude-haiku-4-5-20251001";
    const prompt = interpolate(config.prompt as string);
    const system = interpolate((config.system as string) || "");
    if (!apiKey) throw new Error("Anthropic API key is required");
    if (!prompt) throw new Error("Prompt is required");
    const body: Record<string, unknown> = { model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] };
    if (system) body.system = system;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
    const reply = (data.content as { type: string; text: string }[])?.[0]?.text ?? "";
    return { reply, model, input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens };
  },

  "action_dalle": async ({ config, ctx, interpolate }) => {
    const apiKey = config.api_key as string;
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const prompt = localInterp(config.prompt as string || "");
    if (!apiKey || !prompt) throw new Error("API key and prompt are required");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: Math.min(Number(config.n) || 1, 4),
        size: (config.size as string) || "1024x1024",
        quality: (config.quality as string) || "standard",
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: { message: string } }).error?.message || `DALL-E ${res.status}`);
    }
    const d = await res.json();
    const images = (d.data as { url: string; revised_prompt?: string }[]);
    return { url: images[0]?.url, images: images.map((i) => i.url), revised_prompt: images[0]?.revised_prompt };
  },

  "action_gemini": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const gmInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const gmApiKey = String(config.api_key || "").trim() || process.env.GOOGLE_API_KEY || "";
    if (!gmApiKey) throw new Error("Google API key is required for Gemini node");
    const genAI = new GoogleGenerativeAI(gmApiKey);
    const GEMINI_ALIASES: Record<string, string> = {
      "gemini-1.5-flash": "gemini-2.0-flash",
      "gemini-1.5-pro": "gemini-2.0-flash",
      "gemini-pro": "gemini-2.0-flash",
    };
    const rawGmModel = String(config.model || "gemini-2.0-flash");
    const gmModel = GEMINI_ALIASES[rawGmModel] ?? rawGmModel;
    const model = genAI.getGenerativeModel({ model: gmModel });
    const prompt = gmInterp(String(config.prompt || ""));
    const systemPrompt = config.system_prompt ? gmInterp(String(config.system_prompt)) : "";
    const action = String(config.action || "generate");

    if (action === "vision" && config.image_base64) {
      const imageData = gmInterp(String(config.image_base64)).replace(/^data:[^;]+;base64,/, "");
      const result = await model.generateContent([
        { inlineData: { data: imageData, mimeType: "image/jpeg" } },
        prompt,
      ]);
      return { text: result.response.text(), model: String(config.model) };
    } else {
      const parts = systemPrompt ? [systemPrompt + "\n\n" + prompt] : [prompt];
      const result = await model.generateContent(parts);
      return { text: result.response.text(), model: String(config.model) };
    }
  },

  "action_cohere": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "generate";
    if (!token) throw new Error("Cohere API key is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "generate") {
      const body = { model: config.model as string || "command-r-plus", message: interpolate(config.prompt as string || ""), max_tokens: config.max_tokens ? parseInt(config.max_tokens as string) : 500, temperature: config.temperature ? parseFloat(config.temperature as string) : 0.7 };
      const res = await fetch("https://api.cohere.com/v2/chat", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Cohere ${res.status}`);
      return { text: data.message?.content?.[0]?.text, usage: data.usage };
    } else if (action === "embed") {
      let texts: string[] = [];
      try { texts = JSON.parse(config.texts as string || "[]"); } catch { texts = [config.texts as string]; }
      const body = { model: config.model as string || "embed-english-v3.0", texts, input_type: "search_document" };
      const res = await fetch("https://api.cohere.com/v2/embed", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Cohere ${res.status}`);
      return { embeddings: data.embeddings };
    }
    return undefined;
  },

  "action_replicate": async ({ config, interpolate }) => {
    const token = config.api_token as string;
    const action = (config.action as string) || "run_model";
    if (!token) throw new Error("Replicate API token is required");
    const hdrs = { Authorization: `Token ${token}`, "Content-Type": "application/json" };
    if (action === "run_model") {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(interpolate(config.input as string || "{}")); } catch { /* ignore */ }
      const [owner_model, version] = (config.model_version as string || "").split(":");
      const body = { version, input };
      const res = await fetch(`https://api.replicate.com/v1/predictions`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const pred = await res.json();
      if (!res.ok) throw new Error(pred.detail || `Replicate ${res.status}`);
      // Poll for result (up to 30s)
      let result = pred;
      let attempts = 0;
      while (result.status !== "succeeded" && result.status !== "failed" && attempts < 15) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, { headers: hdrs });
        result = await pollRes.json();
        attempts++;
      }
      if (result.status === "failed") throw new Error(result.error || "Replicate prediction failed");
      void owner_model; // suppress unused warning
      return { output: result.output, status: result.status, id: result.id };
    } else if (action === "get_prediction") {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${config.prediction_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Replicate ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_huggingface": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const modelId = config.model_id as string;
    if (!token || !modelId) throw new Error("Hugging Face API token and model ID are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const prompt = interpolate(config.prompt as string || "");
    const systemPrompt = config.system_prompt as string || "";
    const maxTokens = Number(config.max_tokens) || 512;
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    const body = { model: modelId, messages, max_tokens: maxTokens };
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
    const raw = await res.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new Error(`HuggingFace ${res.status}: ${raw}`); }
    if (!res.ok) {
      const err = data as Record<string, unknown>;
      const errObj = err?.error as Record<string, unknown> | undefined;
      throw new Error(String(errObj?.message ?? err?.error ?? err?.message ?? raw));
    }
    const result = data as { choices: { message: { content: string } }[] };
    return { content: result.choices?.[0]?.message?.content ?? "", raw: data };
  },

  "action_agent": async ({ config, ctx }) => {
    const apiKey = config.api_key as string;
    if (!apiKey) throw new Error("Anthropic API key is required");

    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    const model = (config.model as string) || "claude-opus-4-5";
    const goal = localInterp(config.goal as string || "");
    const systemPrompt = (config.system_prompt as string) || "You are a helpful assistant.";
    const maxTurns = Math.min(Number(config.max_turns) || 10, 20);
    const enabledTools = ((config.tools as string) || "http,code").split(",").map((t) => t.trim());

    if (!goal) throw new Error("Goal is required");

    // Build tool definitions the agent can use
    const agentTools: Record<string, unknown>[] = [];

    if (enabledTools.includes("http")) {
      agentTools.push({
        name: "http_request",
        description: "Make an HTTP request to any URL and return the response",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to request" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], default: "GET" },
            headers: { type: "object", description: "Optional headers as key-value pairs" },
            body: { type: "string", description: "Optional request body (for POST/PUT)" },
          },
          required: ["url"],
        },
      });
    }

    if (enabledTools.includes("code")) {
      agentTools.push({
        name: "run_javascript",
        description: "Execute a JavaScript snippet and return its result. Use `return` to output a value.",
        input_schema: {
          type: "object",
          properties: {
            code: { type: "string", description: "JavaScript code to run. Has access to `input` (all workflow data) and `variables`." },
          },
          required: ["code"],
        },
      });
    }

    if (enabledTools.includes("data_store")) {
      agentTools.push({
        name: "data_store_get",
        description: "Get a value from the workflow data store by key",
        input_schema: {
          type: "object",
          properties: { key: { type: "string" } },
          required: ["key"],
        },
      });
      agentTools.push({
        name: "data_store_set",
        description: "Set a value in the workflow data store",
        input_schema: {
          type: "object",
          properties: { key: { type: "string" }, value: { type: "string" } },
          required: ["key", "value"],
        },
      });
    }

    // Agentic loop
    const messages: { role: string; content: unknown }[] = [
      { role: "user", content: `Workflow context (previous node outputs):\n${JSON.stringify(allData, null, 2)}\n\nGoal: ${goal}` },
    ];

    let turns = 0;
    let finalText = "";
    const toolLogs: { tool: string; input: unknown; result: unknown }[] = [];

    const { createServerClient } = await import("../supabase");

    while (turns < maxTurns) {
      turns++;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: agentTools,
          messages,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: { message: string } }).error?.message || `Anthropic ${res.status}`);
      }

      const response = await res.json() as {
        stop_reason: string;
        content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
      };

      messages.push({ role: "assistant", content: response.content });

      // If stop_reason is "end_turn" or no tool_use, we're done
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim();

      if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) break;

      // Execute all tool calls
      const toolResults: { type: string; tool_use_id: string; content: string }[] = [];

      for (const block of toolUseBlocks) {
        const toolName = block.name as string;
        const toolInput = block.input as Record<string, unknown>;
        let toolResult: unknown;

        try {
          if (toolName === "http_request") {
            const fetchOpts: RequestInit = { method: (toolInput.method as string) || "GET" };
            if (toolInput.headers) fetchOpts.headers = toolInput.headers as Record<string, string>;
            if (toolInput.body) fetchOpts.body = toolInput.body as string;
            const r = await fetch(toolInput.url as string, fetchOpts);
            const ct = r.headers.get("content-type") || "";
            toolResult = { status: r.status, body: ct.includes("json") ? await r.json() : await r.text() };
          } else if (toolName === "run_javascript") {
            // eslint-disable-next-line no-new-func
            const fn = new Function("input", "variables", `"use strict"; ${toolInput.code}`);
            toolResult = await fn(allData, ctx.variables);
          } else if (toolName === "data_store_get") {
            const supabase = createServerClient();
            const { data } = await supabase.from("workflow_data")
              .select("value").eq("org_id", ctx.orgId || "unknown").eq("store", "default").eq("key", toolInput.key as string).single();
            toolResult = { key: toolInput.key, value: data?.value ?? null };
          } else if (toolName === "data_store_set") {
            const supabase = createServerClient();
            await supabase.from("workflow_data")
              .upsert({ org_id: ctx.orgId || "unknown", store: "default", key: toolInput.key as string, value: toolInput.value as string, updated_at: new Date().toISOString() }, { onConflict: "org_id,store,key" });
            toolResult = { key: toolInput.key, saved: true };
          } else {
            toolResult = { error: `Unknown tool: ${toolName}` };
          }
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : String(err) };
        }

        toolLogs.push({ tool: toolName, input: toolInput, result: toolResult });
        toolResults.push({ type: "tool_result", tool_use_id: block.id as string, content: JSON.stringify(toolResult) });
      }

      messages.push({ role: "user", content: toolResults });
    }

    return {
      result: finalText,
      turns,
      tool_calls: toolLogs.length,
      tool_logs: toolLogs,
      messages_count: messages.length,
    };
  },

  "action_mcp_tool": async ({ config, ctx }) => {
    const serverUrl = config.server_url as string;
    const toolName = config.tool_name as string;
    if (!serverUrl || !toolName) throw new Error("Server URL and tool name are required");

    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });

    // Parse arguments — support both JSON literal and {{path}} references
    let args: Record<string, unknown> = {};
    const rawArgs = localInterp(config.arguments as string || "{}");
    try { args = JSON.parse(rawArgs); } catch { /* leave as empty */ }

    const timeout = Math.min(Number(config.timeout) || 30, 120) * 1000;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.auth_header) headers["Authorization"] = config.auth_header as string;

    // Use MCP JSON-RPC protocol over HTTP POST
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const rpcPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      };

      const res = await fetch(serverUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(rpcPayload),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`MCP server returned ${res.status}`);

      const rpcRes = await res.json() as {
        result?: { content?: { type: string; text?: string }[] };
        error?: { message: string };
      };

      if (rpcRes.error) throw new Error(rpcRes.error.message);

      const content = rpcRes.result?.content ?? [];
      const textContent = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      let parsedContent: unknown = textContent;
      try { parsedContent = JSON.parse(textContent); } catch { /* keep as string */ }

      return { tool: toolName, result: parsedContent, raw_content: content };
    } finally {
      clearTimeout(timer);
    }
  },

  "action_groq": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const grInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const Groq = (await import("groq-sdk")).default;
    const grApiKey = String(config.api_key || "").trim() || process.env.GROQ_API_KEY || "";
    if (!grApiKey) throw new Error("Groq API key is required for Groq node");
    const groq = new Groq({ apiKey: grApiKey });
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (config.system_prompt) messages.push({ role: "system", content: grInterp(String(config.system_prompt)) });
    messages.push({ role: "user", content: grInterp(String(config.prompt || "")) });
    const reqOpts: Record<string, unknown> = {
      model: String(config.model || "llama-3.1-8b-instant"),
      messages,
      max_tokens: Number(config.max_tokens || 1024),
      temperature: Number(config.temperature || 0.7),
    };
    if (String(config.json_mode) === "true") reqOpts.response_format = { type: "json_object" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await groq.chat.completions.create(reqOpts as any);
    const text = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown = text;
    if (String(config.json_mode) === "true") { try { parsed = JSON.parse(text); } catch { /* keep */ } }
    return { text, parsed, model: completion.model, usage: completion.usage };
  },

  "action_mistral": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const msInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const { Mistral } = await import("@mistralai/mistralai");
    const msApiKey = String(config.api_key || "").trim() || process.env.MISTRAL_API_KEY || "";
    if (!msApiKey) throw new Error("Mistral API key is required for Mistral node");
    const mistral = new Mistral({ apiKey: msApiKey });
    const msgs: { role: "system" | "user"; content: string }[] = [];
    if (config.system_prompt) msgs.push({ role: "system", content: msInterp(String(config.system_prompt)) });
    msgs.push({ role: "user", content: msInterp(String(config.prompt || "")) });
    const mOpts: Record<string, unknown> = {
      model: String(config.model || "mistral-small-latest"),
      messages: msgs,
      maxTokens: Number(config.max_tokens || 1024),
      temperature: Number(config.temperature || 0.7),
    };
    if (String(config.json_mode) === "true") mOpts.responseFormat = { type: "json_object" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await mistral.chat.complete(mOpts as any);
    const text = (res.choices?.[0]?.message?.content as string) ?? "";
    let parsed: unknown = text;
    if (String(config.json_mode) === "true") { try { parsed = JSON.parse(text); } catch { /* keep */ } }
    return { text, parsed, model: res.model, usage: res.usage };
  },

  "action_whisper": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const wsInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const apiKey = String(config.api_key || "");
    const action = String(config.action || "transcribe");
    const responseFormat = String(config.response_format || "json");
    const language = config.language ? wsInterp(String(config.language)) : undefined;

    // Build multipart form data
    let audioBuffer: Buffer;
    let audioFilename = "audio.mp3";
    if (config.audio_url) {
      const url = wsInterp(String(config.audio_url));
      const r = await fetch(url);
      audioBuffer = Buffer.from(await r.arrayBuffer());
      audioFilename = url.split("/").pop() || "audio.mp3";
    } else {
      const b64 = wsInterp(String(config.audio_base64 || "")).replace(/^data:[^;]+;base64,/, "");
      audioBuffer = Buffer.from(b64, "base64");
    }

    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer.buffer as ArrayBuffer]), audioFilename);
    formData.append("model", "whisper-1");
    formData.append("response_format", responseFormat);
    if (language) formData.append("language", language);

    const endpoint = action === "translate"
      ? "https://api.openai.com/v1/audio/translations"
      : "https://api.openai.com/v1/audio/transcriptions";

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!r.ok) throw new Error(`Whisper error: ${await r.text()}`);
    const result = responseFormat === "json" || responseFormat === "verbose_json" ? await r.json() : { text: await r.text() };
    return result;
  },

  "action_pinecone": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const pcInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const { Pinecone } = await import("@pinecone-database/pinecone");
    const pc = new Pinecone({ apiKey: String(config.api_key || "") });
    const idx = pc.index(String(config.index_name || ""));
    const ns = config.namespace ? idx.namespace(String(config.namespace)) : idx;
    const action = String(config.action || "query");

    if (action === "query") {
      const vecStr = pcInterp(String(config.vector || "[]"));
      let vector: number[] = [];
      try { vector = JSON.parse(vecStr); } catch { /* ignore */ }
      const filterStr = config.filter ? pcInterp(String(config.filter)) : "{}";
      let filter: Record<string, unknown> | undefined;
      try { const f = JSON.parse(filterStr); filter = Object.keys(f).length ? f : undefined; } catch { /* ignore */ }
      const results = await ns.query({ vector, topK: Number(config.top_k || 5), includeMetadata: true, includeValues: false, filter });
      return { matches: results.matches, namespace: results.namespace };
    } else if (action === "upsert") {
      const id = pcInterp(String(config.id || ""));
      const vecStr = pcInterp(String(config.vector || "[]"));
      let values: number[] = [];
      try { values = JSON.parse(vecStr); } catch { /* ignore */ }
      const metaStr = config.metadata ? pcInterp(String(config.metadata)) : "{}";
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(metaStr); } catch { /* ignore */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ns.upsert({ records: [{ id, values, metadata: metadata as any }] });
      return { upserted: true, id };
    } else if (action === "fetch") {
      const id = pcInterp(String(config.id || ""));
      const result = await ns.fetch({ ids: [id] });
      return { record: result.records?.[id] };
    } else if (action === "delete") {
      const id = pcInterp(String(config.id || ""));
      await ns.deleteOne({ id });
      return { deleted: true, id };
    } else if (action === "stats") {
      const stats = await idx.describeIndexStats();
      return stats;
    }
    return undefined;
  },

  "action_weaviate": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const wvInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    // Use REST API directly since weaviate-client v3 has complex peer deps
    const host = wvInterp(String(config.host || "http://localhost:8080")).replace(/\/$/, "");
    const apiKey = config.api_key ? String(config.api_key) : "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const collection = String(config.collection || "");
    const action = String(config.action || "search");
    const limit = Number(config.limit || 5);
    const props = config.properties ? String(config.properties).split(",").map((s) => s.trim()) : [];

    if (action === "search") {
      const queryText = wvInterp(String(config.query_text || ""));
      const graphql = { query: `{Get{${collection}(nearText:{concepts:["${queryText}"]}limit:${limit}){${props.join(" ") || "_additional{id distance}"}}} }` };
      const r = await fetch(`${host}/v1/graphql`, { method: "POST", headers, body: JSON.stringify(graphql) });
      if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
      return await r.json();
    } else if (action === "vector_search") {
      const vecStr = wvInterp(String(config.vector || "[]"));
      let vector: number[] = [];
      try { vector = JSON.parse(vecStr); } catch { /* ignore */ }
      const graphql = { query: `{Get{${collection}(nearVector:{vector:${JSON.stringify(vector)}}limit:${limit}){${props.join(" ") || "_additional{id distance}"}}} }` };
      const r = await fetch(`${host}/v1/graphql`, { method: "POST", headers, body: JSON.stringify(graphql) });
      if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
      return await r.json();
    } else if (action === "get") {
      const id = wvInterp(String(config.id || ""));
      const r = await fetch(`${host}/v1/objects/${collection}/${id}`, { headers });
      if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
      return await r.json();
    } else if (action === "create") {
      const objStr = wvInterp(String(config.object || "{}"));
      let obj: Record<string, unknown> = {};
      try { obj = JSON.parse(objStr); } catch { /* ignore */ }
      const body = { class: collection, properties: obj };
      const r = await fetch(`${host}/v1/objects`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
      return await r.json();
    } else if (action === "delete") {
      const id = wvInterp(String(config.id || ""));
      const r = await fetch(`${host}/v1/objects/${collection}/${id}`, { method: "DELETE", headers });
      return { deleted: r.ok, id };
    }
    return undefined;
  },
};
