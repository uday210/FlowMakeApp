import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list all datasets for org
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("analytics_datasets")
    .select("id, name, source_type, columns, row_count, created_at, parent_ids")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — create dataset from uploaded data
// Body: { name, source_type, columns: string[], rows: Record<string,unknown>[] }
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, source_type, columns, rows, parent_ids } = body;

  if (!name || !rows || !columns) return NextResponse.json({ error: "name, columns and rows required" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("analytics_datasets")
    .insert({
      org_id: ctx.orgId,
      name,
      source_type: source_type ?? "upload",
      columns,
      row_count: rows.length,
      data: rows,
      parent_ids: parent_ids ?? [],
    })
    .select("id, name, source_type, columns, row_count, created_at, parent_ids")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
