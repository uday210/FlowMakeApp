import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}

// Public endpoint — no auth required.
// Returns only the fields needed to render the embed widget.
// Never exposes api_key or org_id.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("chatbots")
    .select(
      "id, name, agent_type, is_active, appearance, starter_questions, behavior, intents"
    )
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Agent not found or inactive" },
      { status: 404, headers: CORS }
    );
  }

  return NextResponse.json(data, { headers: CORS });
}
