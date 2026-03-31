import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: src, error: fetchErr } = await ctx.admin
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (fetchErr || !src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("email_templates")
    .insert({
      org_id:     ctx.orgId,
      name:       `${src.name} (Copy)`,
      description: src.description,
      category:   src.category,
      subject:    src.subject,
      blocks:     src.blocks,
      settings:   src.settings,
      html_body:  src.html_body,
      plain_body: src.plain_body,
      variables:  src.variables,
      usage_count: 0,
    })
    .select("id, name, description, category, subject, variables, usage_count, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
