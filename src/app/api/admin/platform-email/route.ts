import { NextResponse } from "next/server";
import { getSuperAdminClient } from "@/lib/auth";
import { sendEmailWithConfig } from "@/lib/emailSender";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await admin
    .from("platform_settings")
    .select("email_provider, email_from, email_from_name, email_mailgun_domain, email_mailgun_region, email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_secure, email_mailtrap_inbox_id, updated_at")
    .eq("id", 1)
    .single();

  // Never return secrets — just metadata
  return NextResponse.json(data ?? {});
}

export async function PUT(request: Request) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  const update: Record<string, unknown> = {
    email_provider:          body.provider ?? null,
    email_from:              body.from_email ?? null,
    email_from_name:         body.from_name ?? null,
    email_mailgun_domain:    body.mailgun_domain ?? null,
    email_mailgun_region:    body.mailgun_region ?? "us",
    email_smtp_host:         body.smtp_host ?? null,
    email_smtp_port:         body.smtp_port ?? null,
    email_smtp_user:         body.smtp_user ?? null,
    email_smtp_secure:       body.smtp_secure ?? true,
    email_mailtrap_inbox_id: body.mailtrap_inbox_id ?? null,
    updated_at:              new Date().toISOString(),
  };

  // Only update secrets if a new value was provided (empty string = keep existing)
  if (body.api_key)   update.email_api_key   = body.api_key;
  if (body.smtp_pass) update.email_smtp_pass = body.smtp_pass;

  const { error } = await admin
    .from("platform_settings")
    .update(update)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Test send — fires a real email using the saved platform config
export async function POST(request: Request) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const { data: settings } = await admin
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings?.email_provider) {
    return NextResponse.json({ error: "No platform email configured" }, { status: 400 });
  }

  const config = {
    provider:        settings.email_provider,
    from_email:      settings.email_from,
    from_name:       settings.email_from_name ?? "",
    api_key:         settings.email_api_key,
    mailgun_domain:  settings.email_mailgun_domain,
    mailgun_region:  settings.email_mailgun_region,
    smtp_host:       settings.email_smtp_host,
    smtp_port:       settings.email_smtp_port,
    smtp_user:       settings.email_smtp_user,
    smtp_pass:       settings.email_smtp_pass,
    smtp_secure:     settings.email_smtp_secure,
  };

  const ok = await sendEmailWithConfig(config, {
    orgId: "platform",
    to,
    subject: "FlowMake — Platform Email Test",
    htmlBody: `<p>This is a test email from your <strong>FlowMake platform email</strong> configuration.</p><p>If you received this, your platform email is working correctly.</p>`,
    plainBody: "This is a test email from your FlowMake platform email configuration.",
  });

  if (!ok) return NextResponse.json({ error: "Failed to send — check your config" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
