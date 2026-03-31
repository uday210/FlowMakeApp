import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a workflow automation builder. Given a plain-English description, generate a JSON workflow with nodes and edges.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "name": "Workflow name",
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger_webhook",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Webhook Trigger",
        "type": "trigger_webhook",
        "config": {}
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    }
  ]
}

Available node types:
TRIGGERS: trigger_webhook, trigger_schedule, trigger_form, trigger_email, trigger_agent
ACTIONS: action_http, action_send_email, action_slack, action_openai, action_claude, action_if_else, action_filter, action_delay, action_user_table, action_webhook_response, action_set_variable, action_run_code, action_transform_data, action_telegram, action_discord, action_sheets, action_notion, action_airtable, action_hubspot, action_stripe

Rules:
- Always start with exactly one trigger node at position {x: 100, y: 200}
- Place subsequent nodes at x+250 increments
- Keep edges simple: source → target
- Use descriptive labels
- Keep config as {} unless obvious (e.g. action_send_email gets {"to":"","subject":"","body":""})
- Maximum 6 nodes total`;

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const json = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(json);

    const { data, error } = await ctx.admin
      .from("workflows")
      .insert({
        name: parsed.name ?? "AI Generated Workflow",
        nodes: parsed.nodes ?? [],
        edges: parsed.edges ?? [],
        is_active: false,
        org_id: ctx.orgId,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("AI generate error:", err);
    return NextResponse.json({ error: "Failed to generate workflow" }, { status: 500 });
  }
}
