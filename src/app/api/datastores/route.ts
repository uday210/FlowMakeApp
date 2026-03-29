import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/datastores — list all data store keys/values
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store") ?? "default";
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_data")
    .select("*")
    .eq("store", store)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/datastores — set a key
export async function POST(request: Request) {
  const body = await request.json();
  const { store = "default", key, value } = body;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("workflow_data")
    .upsert({ store, key, value: String(value ?? ""), updated_at: new Date().toISOString() }, { onConflict: "store,key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/datastores?store=x&key=y
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store") ?? "default";
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("workflow_data")
    .delete()
    .eq("store", store)
    .eq("key", key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
