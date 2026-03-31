import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify agent belongs to this org
  const { data: agent } = await ctx.admin.from("chatbots").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("agent_conversations")
    .select("*")
    .eq("agent_id", id)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify agent belongs to this org
  const { data: agent } = await ctx.admin.from("chatbots").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("agent_conversations")
    .insert({
      agent_id: id,
      messages: body.messages ?? [],
      message_count: body.message_count ?? 0,
      source: body.source ?? "preview",
      ended_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
