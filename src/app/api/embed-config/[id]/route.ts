import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Public endpoint — no auth required.
// Returns only the fields needed to render the embed widget.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500, headers: CORS });
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("chatbots")
    .select("id, name, agent_type, appearance, starter_questions, behavior, intents")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404, headers: CORS }
    );
  }

  return NextResponse.json(data, { headers: CORS });
}
