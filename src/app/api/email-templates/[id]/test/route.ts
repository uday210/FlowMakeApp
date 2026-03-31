import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { sendEmail } from "@/lib/emailSender";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const { data: tmpl } = await ctx.admin
    .from("email_templates")
    .select("name, subject, html_body, plain_body")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!tmpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Replace variables with placeholder values for preview
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => `[${k}]`);

  const sent = await sendEmail({
    orgId:    ctx.orgId,
    to,
    subject:  fill(tmpl.subject || tmpl.name),
    htmlBody: fill(tmpl.html_body || "<p>No content</p>"),
    plainBody: fill(tmpl.plain_body || ""),
  });

  if (!sent) return NextResponse.json({ error: "No active email provider configured for this org." }, { status: 400 });
  return NextResponse.json({ success: true });
}
