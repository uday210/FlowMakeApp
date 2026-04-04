import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const fwdHost  = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto");
  if (fwdHost) {
    const proto = (fwdProto ?? "https").split(",")[0].trim();
    return `${proto}://${fwdHost}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    params.forEach((v, k) => { result[k] = v; });
    return result;
  } catch {
    return {};
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const admin = getAdmin();

    const body       = await parseBody(req);
    const callSid    = body.CallSid      ?? "";
    const speechText = (body.SpeechResult ?? "").trim();

    const gatherUrl  = `${getBaseUrl(req)}/api/voice/gather/${agentId}`;

    // Load agent
    const { data: agent, error: agentErr } = await admin
      .from("voice_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`);
    }

    const voice    = escapeXml(agent.voice);
    const language = escapeXml(agent.language);

    // Load call record by callSid
    const { data: call } = await admin
      .from("voice_calls")
      .select("id, transcript")
      .eq("call_sid", callSid)
      .single();

    const transcript: { role: string; text: string; ts: string }[] =
      (call?.transcript as { role: string; text: string; ts: string }[]) ?? [];

    // No speech detected
    if (!speechText) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">I didn't catch that. Could you please repeat?</Say>
  <Gather input="speech" action="${escapeXml(gatherUrl)}" method="POST" speechTimeout="auto" language="${language}" actionOnEmptyResult="true"/>
  <Hangup/>
</Response>`);
    }

    // Append user turn
    transcript.push({ role: "user", text: speechText, ts: new Date().toISOString() });

    // Check max turns
    const userTurns = transcript.filter(t => t.role === "user").length;
    if (userTurns > agent.max_turns) {
      if (call) {
        await admin.from("voice_calls").update({ transcript }).eq("id", call.id).then(() => {}, () => {});
      }
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">We have reached the end of our conversation. Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`);
    }

    // ── Build OpenAI tools from agent config ──────────────────────────────
    type AgentTool = { type: string; table_id?: string; workflow_id?: string; description?: string; name?: string };
    const configuredTools: AgentTool[] = (agent.tools as AgentTool[]) ?? [];
    const openAITools = configuredTools.map((t: AgentTool) => {
      if (t.type === "query_table") {
        return {
          type: "function" as const,
          function: {
            name: `query_table_${t.table_id}`,
            description: t.description || "Look up information from a data table",
            parameters: {
              type: "object",
              properties: {
                filter_field:  { type: "string", description: "Column name to filter by" },
                filter_value:  { type: "string", description: "Value to search for" },
              },
              required: [],
            },
          },
        };
      }
      if (t.type === "insert_row") {
        return {
          type: "function" as const,
          function: {
            name: `insert_row_${t.table_id}`,
            description: t.description || "Save information into a data table",
            parameters: {
              type: "object",
              properties: {
                data: { type: "object", description: "Key-value pairs of column name to value" },
              },
              required: ["data"],
            },
          },
        };
      }
      if (t.type === "trigger_workflow") {
        return {
          type: "function" as const,
          function: {
            name: `trigger_workflow_${t.workflow_id}`,
            description: t.description || "Trigger an automation workflow",
            parameters: {
              type: "object",
              properties: {
                data: { type: "object", description: "Data to pass to the workflow" },
              },
              required: [],
            },
          },
        };
      }
      return null;
    }).filter(Boolean);

    // ── Execute a tool call ───────────────────────────────────────────────
    async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
      const matchedTool = configuredTools.find((t: AgentTool) => {
        if (t.type === "query_table")      return name === `query_table_${t.table_id}`;
        if (t.type === "insert_row")       return name === `insert_row_${t.table_id}`;
        if (t.type === "trigger_workflow") return name === `trigger_workflow_${t.workflow_id}`;
        return false;
      });
      if (!matchedTool) return "Tool not found.";

      if (matchedTool.type === "query_table" && matchedTool.table_id) {
        const q = admin.from("user_table_rows").select("data").eq("table_id", matchedTool.table_id).limit(5);
        if (args.filter_field && args.filter_value) {
          // JS-side filter since data is JSONB
          const { data: rows } = await q;
          const filtered = (rows ?? []).filter(r =>
            String((r.data as Record<string, unknown>)[args.filter_field as string] ?? "")
              .toLowerCase()
              .includes(String(args.filter_value).toLowerCase())
          );
          return filtered.length
            ? JSON.stringify(filtered.map(r => r.data))
            : "No matching records found.";
        }
        const { data: rows } = await q;
        return rows?.length ? JSON.stringify(rows.map(r => r.data)) : "No records found.";
      }

      if (matchedTool.type === "insert_row" && matchedTool.table_id) {
        const { error } = await admin.from("user_table_rows").insert({
          table_id: matchedTool.table_id,
          data: args.data ?? {},
        });
        return error ? `Failed to save: ${error.message}` : "Information saved successfully.";
      }

      if (matchedTool.type === "trigger_workflow" && matchedTool.workflow_id) {
        try {
          const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
          await fetch(`${base}/api/execute/${matchedTool.workflow_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "voice_agent", agentId, ...(args.data as object ?? {}) }),
          });
          return "Workflow triggered successfully.";
        } catch {
          return "Failed to trigger workflow.";
        }
      }

      return "Unknown tool.";
    }

    // ── Call OpenAI with function calling ─────────────────────────────────
    let agentReply = "I'm sorry, I'm having trouble responding right now. Please try again later.";
    try {
      const messages: Record<string, unknown>[] = [
        {
          role: "system",
          content: agent.system_prompt +
            "\n\nCRITICAL: This is a phone call. Keep every response under 2 short sentences. No markdown, no lists, no special characters.",
        },
        ...transcript.map((t: { role: string; text: string }) => ({
          role: t.role,
          content: t.text,
        })),
      ];

      const body: Record<string, unknown> = {
        model: agent.llm_model,
        messages,
        max_tokens: 200,
        temperature: 0.7,
      };
      if (openAITools.length > 0) {
        body.tools = openAITools;
        body.tool_choice = "auto";
      }

      const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${agent.llm_api_key}`,
        },
        body: JSON.stringify(body),
      });

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        const choice = llmData.choices?.[0];

        // Handle tool calls
        if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
          const toolResults: Record<string, unknown>[] = [];
          for (const tc of choice.message.tool_calls) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* use empty */ }
            const result = await executeTool(tc.function.name, args);
            toolResults.push({ tool_call_id: tc.id, role: "tool", content: result });
          }

          // Second LLM call with tool results
          const messages2 = [...messages, choice.message, ...toolResults];
          const llmRes2 = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${agent.llm_api_key}`,
            },
            body: JSON.stringify({ model: agent.llm_model, messages: messages2, max_tokens: 120, temperature: 0.7 }),
          });
          if (llmRes2.ok) {
            const d2 = await llmRes2.json();
            agentReply = d2.choices?.[0]?.message?.content?.trim() ?? agentReply;
          }
        } else {
          agentReply = choice?.message?.content?.trim() ?? agentReply;
        }
      } else {
        console.error("[voice/gather] OpenAI error:", await llmRes.text());
      }
    } catch (llmErr) {
      console.error("[voice/gather] LLM call failed:", llmErr);
    }

    // Append assistant turn & save
    transcript.push({ role: "assistant", text: agentReply, ts: new Date().toISOString() });
    if (call) {
      await admin.from("voice_calls").update({ transcript }).eq("id", call.id).then(() => {}, () => {});
    }

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(agentReply)}</Say>
  <Gather input="speech" action="${escapeXml(gatherUrl)}" method="POST" speechTimeout="auto" language="${language}" actionOnEmptyResult="true"/>
  <Hangup/>
</Response>`);

  } catch (err) {
    console.error("[voice/gather] unhandled error:", err);
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>An error occurred. Please try again. Goodbye.</Say><Hangup/></Response>`);
  }
}
