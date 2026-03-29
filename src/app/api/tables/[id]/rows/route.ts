import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 1000);
  const offset = Number(url.searchParams.get("offset") || 0);

  const { data, error, count } = await supabase
    .from("user_table_rows")
    .select("*", { count: "exact" })
    .eq("table_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], total: count ?? 0 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from("user_table_rows")
    .insert({ table_id: id, data: body.data || body })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const url = new URL(req.url);
  const rowId = url.searchParams.get("rowId");
  if (rowId) {
    await supabase.from("user_table_rows").delete().eq("id", rowId).eq("table_id", id);
  } else {
    // Clear all rows
    await supabase.from("user_table_rows").delete().eq("table_id", id);
  }
  return NextResponse.json({ deleted: true });
}
