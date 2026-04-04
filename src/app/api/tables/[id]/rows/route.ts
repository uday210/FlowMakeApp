import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function verifyTableOwnership(tableId: string, orgId: string, admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from("user_tables").select("id").eq("id", tableId).eq("org_id", orgId).single();
  return !!data;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await verifyTableOwnership(id, ctx.orgId, ctx.admin);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 1000);
  const offset = Number(url.searchParams.get("offset") || 0);

  const { data, error, count } = await ctx.admin
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
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await verifyTableOwnership(id, ctx.orgId, ctx.admin);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { data, error } = await ctx.admin
    .from("user_table_rows")
    .insert({ table_id: id, data: body.data || body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await verifyTableOwnership(id, ctx.orgId, ctx.admin);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Bulk edit: { rowIds: string[], patch: Record<string, unknown> }
  if (Array.isArray(body.rowIds) && body.rowIds.length > 0) {
    const { data: existing, error: fetchErr } = await ctx.admin
      .from("user_table_rows")
      .select("id, data")
      .in("id", body.rowIds)
      .eq("table_id", id);
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const updates = (existing ?? []).map(row => ({
      id: row.id,
      data: { ...row.data, ...body.patch },
    }));
    const { error: upsertErr } = await ctx.admin
      .from("user_table_rows")
      .upsert(updates, { onConflict: "id" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    return NextResponse.json({ updated: updates.length });
  }

  // Single-row edit: ?rowId=...
  const url = new URL(req.url);
  const rowId = url.searchParams.get("rowId");
  if (!rowId) return NextResponse.json({ error: "rowId required" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("user_table_rows")
    .update({ data: body.data })
    .eq("id", rowId)
    .eq("table_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await verifyTableOwnership(id, ctx.orgId, ctx.admin);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const rowId = url.searchParams.get("rowId");
  if (rowId) {
    await ctx.admin.from("user_table_rows").delete().eq("id", rowId).eq("table_id", id);
  } else {
    // Clear all rows
    await ctx.admin.from("user_table_rows").delete().eq("table_id", id);
  }
  return NextResponse.json({ deleted: true });
}
