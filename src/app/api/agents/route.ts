import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("chatbots")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("chatbots")
    .insert({
      name: body.name,
      description: body.description ?? "",
      system_prompt: body.system_prompt ?? "You are a helpful assistant.",
      model: body.model ?? "claude-haiku-4-5-20251001",
      appearance: body.appearance ?? {
        primaryColor: "#7c3aed",
        greetingMessage: "Hi! How can I help you today?",
        placeholder: "Type a message...",
        agentName: "Assistant",
        showBranding: true,
      },
      starter_questions: body.starter_questions ?? [],
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
