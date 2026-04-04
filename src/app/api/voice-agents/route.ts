import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("voice_agents")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, system_prompt, greeting, voice, language,
          llm_provider, llm_model, llm_api_key,
          twilio_account_sid, twilio_auth_token, twilio_phone_number,
          max_turns } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("voice_agents")
    .insert({
      org_id: ctx.orgId,
      name: name.trim(),
      description: description?.trim() ?? "",
      system_prompt: system_prompt?.trim() ?? "",
      greeting: greeting?.trim() ?? "Hello! How can I help you today?",
      voice: voice ?? "Polly.Joanna",
      language: language ?? "en-US",
      llm_provider: llm_provider ?? "openai",
      llm_model: llm_model ?? "gpt-4o-mini",
      llm_api_key: llm_api_key ?? "",
      twilio_account_sid: twilio_account_sid ?? "",
      twilio_auth_token: twilio_auth_token ?? "",
      twilio_phone_number: twilio_phone_number ?? "",
      max_turns: max_turns ?? 10,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
