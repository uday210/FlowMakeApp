import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const agentCallable = searchParams.get("agent_callable") === "true";

  let query = supabase.from("workflows").select("*").order("created_at", { ascending: false });

  if (agentCallable) {
    // Filter workflows that contain at least one trigger_agent node
    query = query.filter("nodes", "cs", JSON.stringify([{ data: { type: "trigger_agent" } }]));
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      name: body.name || "Untitled Workflow",
      description: body.description || "",
      nodes: body.nodes || [],
      edges: body.edges || [],
      is_active: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
