import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function verifyOwnership(id: string, ctx: Awaited<ReturnType<typeof getOrgContext>>) {
  if (!ctx) return null;
  const { data } = await ctx.admin
    .from("voice_agents")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  return data;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await verifyOwnership(id, ctx);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await verifyOwnership(id, ctx);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const allowed = [
    "name", "description", "system_prompt", "greeting", "voice", "language",
    "llm_provider", "llm_model", "llm_api_key",
    "twilio_account_sid", "twilio_auth_token", "twilio_phone_number",
    "max_turns", "is_active", "tools",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  const { data, error } = await ctx.admin
    .from("voice_agents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await verifyOwnership(id, ctx);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await ctx.admin.from("voice_agents").delete().eq("id", id);
  return NextResponse.json({ deleted: true });
}
