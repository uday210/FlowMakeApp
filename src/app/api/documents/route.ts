import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("esign_documents")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from("esign_documents")
    .insert({
      name: body.name,
      file_path: body.file_path,
      file_url: body.file_url,
      page_count: body.page_count || 1,
      status: "draft",
      org_id: ctx.orgId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "esign_document.created",
    resourceType: "esign_document",
    resourceId: String(data.id),
    meta: { name: body.name },
  });
  return NextResponse.json(data, { status: 201 });
}
