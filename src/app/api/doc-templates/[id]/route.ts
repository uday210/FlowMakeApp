import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/doc-templates/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.admin
    .from("doc_templates")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/doc-templates/[id] — update metadata / field mappings / sample data
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)          updates.name = body.name;
  if (body.description !== undefined)   updates.description = body.description;
  if (body.category !== undefined)      updates.category = body.category;
  if (body.field_mappings !== undefined) updates.field_mappings = body.field_mappings;
  if (body.sample_data !== undefined)   updates.sample_data = body.sample_data;

  const { data, error } = await ctx.admin
    .from("doc_templates")
    .update(updates)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/doc-templates/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Fetch to get file_path first
  const { data: tpl } = await ctx.admin
    .from("doc_templates")
    .select("file_path")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tpl?.file_path) {
    await ctx.admin.storage.from("doc-templates").remove([tpl.file_path]);
  }

  const { error } = await ctx.admin
    .from("doc_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
