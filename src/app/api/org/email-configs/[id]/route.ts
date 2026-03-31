import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { sendEmailWithConfig } from "@/lib/emailSender";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Handle activate — enforce one-active-at-a-time by deactivating others first
  if (body._action === "activate") {
    await ctx.admin.from("org_email_configs").update({ is_active: false }).eq("org_id", ctx.orgId);
    const { data, error } = await ctx.admin
      .from("org_email_configs")
      .update({ is_active: true })
      .eq("id", id).eq("org_id", ctx.orgId)
      .select("id, name, provider, from_email, from_name, is_active, verified, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Handle test email
  if (body._action === "test") {
    const testTo = body.test_to;
    if (!testTo) return NextResponse.json({ error: "test_to is required" }, { status: 400 });

    // Fetch full config including credentials
    const { data: config } = await ctx.admin
      .from("org_email_configs")
      .select("*")
      .eq("id", id).eq("org_id", ctx.orgId)
      .single();

    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    // Send using this specific config (regardless of whether it's active)
    const sent = await sendEmailWithConfig(config, {
      orgId: ctx.orgId,
      to: testTo,
      subject: "Test email from FlowMake",
      htmlBody: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:500px">
        <h2 style="color:#4f46e5;margin:0 0 12px">✓ Email Config Working</h2>
        <p style="color:#374151;margin:0 0 8px">This is a test email from your <strong>${config.name}</strong> email configuration.</p>
        <p style="color:#374151;margin:0 0 8px">Provider: <strong>${config.provider}</strong></p>
        <p style="color:#374151;margin:0">From: <strong>${config.from_email}</strong></p>
      </div>`,
      plainBody: `Email config test — Provider: ${config.provider}, From: ${config.from_email}`,
    });

    if (!sent) return NextResponse.json({ error: "Failed to send test email. Check your credentials." }, { status: 400 });

    // Mark as verified
    await ctx.admin.from("org_email_configs").update({ verified: true }).eq("id", id).eq("org_id", ctx.orgId);
    return NextResponse.json({ success: true });
  }

  // Normal update
  const { data, error } = await ctx.admin
    .from("org_email_configs")
    .update({
      name:           body.name,
      provider:       body.provider,
      from_email:     body.from_email,
      from_name:      body.from_name,
      api_key:        body.api_key || null,
      mailgun_domain: body.mailgun_domain || null,
      mailgun_region: body.mailgun_region || "us",
      smtp_host:      body.smtp_host || null,
      smtp_port:      body.smtp_port || null,
      smtp_user:      body.smtp_user || null,
      smtp_pass:      body.smtp_pass || null,
      smtp_secure:    body.smtp_secure ?? true,
      verified:       false, // reset verification on credential change
      updated_at:     new Date().toISOString(),
    })
    .eq("id", id).eq("org_id", ctx.orgId)
    .select("id, name, provider, from_email, from_name, is_active, verified, created_at, mailgun_region, mailgun_domain, smtp_host, smtp_port")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await ctx.admin
    .from("org_email_configs")
    .delete()
    .eq("id", id).eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
