import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

const DEFAULT_APPEARANCE = {
  agentName: "Assistant",
  avatar: "🤖",
  primaryColor: "#7c3aed",
  headerBg: "#7c3aed",
  userBubbleBg: "#7c3aed",
  botBubbleBg: "#ffffff",
  userBubbleText: "#ffffff",
  botBubbleText: "#1f2937",
  greetingMessage: "Hi! How can I help you today?",
  placeholder: "Type a message...",
  sendButtonLabel: "Send",
  showBranding: true,
  position: "bottom-right",
  windowWidth: 400,
  borderRadius: 16,
};

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("chatbots")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitCheck = await checkPlanLimit(ctx.admin, ctx.orgId, "agents");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Plan limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} AI agents. Upgrade to create more.` },
      { status: 403 }
    );
  }

  const body = await req.json();

  const { data, error } = await ctx.admin
    .from("chatbots")
    .insert({
      name: body.name,
      description: body.description ?? "",
      system_prompt: body.system_prompt ?? "You are a helpful assistant.",
      model: body.model ?? "claude-haiku-4-5-20251001",
      provider: body.provider ?? "anthropic",
      api_key: body.api_key ?? "",
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
      knowledge_base: body.knowledge_base ?? "",
      connected_workflows: body.connected_workflows ?? [],
      appearance: body.appearance ?? DEFAULT_APPEARANCE,
      starter_questions: body.starter_questions ?? [],
      is_active: body.is_active ?? true,
      agent_type: body.agent_type ?? "full",
      intents: body.intents ?? [],
      org_id: ctx.orgId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
