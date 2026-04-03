import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("email_templates")
    .select("id, name, description, category, subject, variables, usage_count, created_at, updated_at")
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from("email_templates")
    .insert({
      org_id: ctx.orgId,
      name: body.name || "Untitled Template",
      description: body.description || "",
      category: body.category || "custom",
      subject: body.subject || "",
      blocks: body.blocks || [],
      settings: body.settings || {},
      html_body: body.html_body || "",
      plain_body: body.plain_body || "",
      variables: body.variables || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "email_template.created",
    resourceType: "email_template",
    resourceId: String(data.id),
    meta: { name: body.name },
  });
  return NextResponse.json(data, { status: 201 });
}
