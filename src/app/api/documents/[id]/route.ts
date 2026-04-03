import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: Record<string, unknown> = {
    name: body.name,
    page_count: body.page_count,
    status: body.status,
    is_template: body.is_template ?? false,
    email_template_id: body.email_template_id ?? null,
  };
  // Only update ai_enabled when explicitly provided so other saves don't reset it
  if (body.ai_enabled !== undefined) patch.ai_enabled = body.ai_enabled;
  const { data, error } = await ctx.admin
    .from("esign_documents")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await ctx.admin
    .from("esign_documents")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
