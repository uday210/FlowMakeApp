import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("chatbots")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt;
  if (body.model !== undefined) updateData.model = body.model;
  if (body.provider !== undefined) updateData.provider = body.provider;
  if (body.api_key !== undefined) updateData.api_key = body.api_key;
  if (body.temperature !== undefined) updateData.temperature = body.temperature;
  if (body.max_tokens !== undefined) updateData.max_tokens = body.max_tokens;
  if (body.knowledge_base !== undefined) updateData.knowledge_base = body.knowledge_base;
  if (body.connected_workflows !== undefined) updateData.connected_workflows = body.connected_workflows;
  if (body.appearance !== undefined) updateData.appearance = body.appearance;
  if (body.starter_questions !== undefined) updateData.starter_questions = body.starter_questions;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  if (body.agent_type !== undefined) updateData.agent_type = body.agent_type;
  if (body.intents !== undefined) updateData.intents = body.intents;
  if (body.mcp_tools !== undefined) updateData.mcp_tools = body.mcp_tools;

  const { data, error } = await ctx.admin
    .from("chatbots")
    .update(updateData)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await ctx.admin
    .from("chatbots")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "agent.deleted",
    resourceType: "agent",
    resourceId: id,
  });
  return NextResponse.json({ success: true });
}
