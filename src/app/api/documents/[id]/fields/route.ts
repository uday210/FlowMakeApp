import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify document belongs to this org
  const { data: doc } = await ctx.admin.from("esign_documents").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("esign_fields")
    .select("*")
    .eq("document_id", id)
    .order("page");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify document belongs to this org
  const { data: doc } = await ctx.admin.from("esign_documents").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fields } = await request.json() as { fields: Record<string, unknown>[] };

  // Replace all fields for this document
  await ctx.admin.from("esign_fields").delete().eq("document_id", id);

  if (fields.length > 0) {
    const rows = fields.map((f) => ({ ...f, document_id: id }));
    const { error } = await ctx.admin.from("esign_fields").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
