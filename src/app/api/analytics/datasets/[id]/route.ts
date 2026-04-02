import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — fetch dataset with full data (paginated)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "0");
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "100");

  const { data, error } = await ctx.admin
    .from("analytics_datasets")
    .select("id, name, source_type, columns, row_count, data, created_at, parent_ids")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

  const rows = (data.data ?? []) as Record<string, unknown>[];
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return NextResponse.json({ ...data, data: paginatedRows, total_rows: rows.length });
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await ctx.admin
    .from("analytics_datasets")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
