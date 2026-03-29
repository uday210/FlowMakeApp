import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an AI assistant configuration expert. Given a description of what kind of chatbot someone wants, generate a focused configuration for that AI assistant.

Return ONLY a valid JSON object with no markdown fences, no explanation, no extra text:

{
  "name": "Short descriptive name (2-4 words)",
  "description": "One sentence describing what this assistant does",
  "system_prompt": "Detailed system prompt that makes the assistant highly focused and effective for its purpose. Include personality, tone, constraints, and any specific knowledge or behaviors needed.",
  "starter_questions": ["Question 1?", "Question 2?", "Question 3?"],
  "appearance": {
    "primaryColor": "#hexcolor",
    "greetingMessage": "Friendly opening message",
    "agentName": "Agent display name"
  }
}

Guidelines:
- name should be short, professional, Title Case (e.g. "Support Bot", "Sales Assistant")
- system_prompt should be comprehensive (3-6 sentences), specific to the use case
- starter_questions: 3-4 relevant example questions users might ask
- primaryColor: pick a color that fits the use case (e.g. blue for support, green for sales, purple for AI)
- greetingMessage: warm, on-brand, specific to the use case
- agentName: a friendly name for the assistant persona`;

export async function POST(req: Request) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY configured" }, { status: 500 });
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt.trim() }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const config = JSON.parse(jsonText);
  return NextResponse.json(config);
}
