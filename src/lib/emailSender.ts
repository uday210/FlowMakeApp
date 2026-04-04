/**
 * Unified email sender.
 * Priority: org active config → app-level Resend env vars → skip (no email configured)
 */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { interpolateVariables } from "./emailTemplateRenderer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface SendEmailOptions {
  orgId: string;
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  plainBody?: string;
  replyTo?: string;
}

interface OrgEmailConfig {
  provider: string;
  from_email: string;
  from_name: string;
  api_key?: string;
  mailgun_domain?: string;
  mailgun_region?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
}

async function getOrgEmailConfig(orgId: string): Promise<OrgEmailConfig | null> {
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await admin
    .from("org_email_configs")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .single();
  return data ?? null;
}

async function getPlatformEmailConfig(): Promise<OrgEmailConfig | null> {
  try {
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await admin
      .from("platform_settings")
      .select("email_provider, email_from, email_from_name, email_api_key, email_mailgun_domain, email_mailgun_region, email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, email_smtp_secure")
      .eq("id", 1)
      .single();

    if (!data?.email_provider || !data?.email_from) return null;

    return {
      provider:       data.email_provider,
      from_email:     data.email_from,
      from_name:      data.email_from_name ?? "",
      api_key:        data.email_api_key ?? undefined,
      mailgun_domain: data.email_mailgun_domain ?? undefined,
      mailgun_region: data.email_mailgun_region ?? "us",
      smtp_host:      data.email_smtp_host ?? undefined,
      smtp_port:      data.email_smtp_port ?? undefined,
      smtp_user:      data.email_smtp_user ?? undefined,
      smtp_pass:      data.email_smtp_pass ?? undefined,
      smtp_secure:    data.email_smtp_secure ?? true,
    };
  } catch {
    return null;
  }
}

async function sendViaResend(config: { apiKey: string; from: string; fromName: string }, opts: SendEmailOptions) {
  const from = config.fromName ? `${config.fromName} <${config.from}>` : config.from;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.toName ? `${opts.toName} <${opts.to}>` : opts.to],
      subject: opts.subject,
      html: opts.htmlBody,
      text: opts.plainBody,
      reply_to: opts.replyTo,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return await res.json();
}

async function sendViaSendGrid(config: { apiKey: string; from: string; fromName: string }, opts: SendEmailOptions) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to, name: opts.toName }] }],
      from: { email: config.from, name: config.fromName },
      subject: opts.subject,
      content: [
        { type: "text/plain", value: opts.plainBody || opts.subject },
        { type: "text/html", value: opts.htmlBody },
      ],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid error: ${res.status}`);
}

async function sendViaMailgun(config: OrgEmailConfig, opts: SendEmailOptions) {
  const region = config.mailgun_region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
  const domain = config.mailgun_domain!;
  const auth = Buffer.from(`api:${config.api_key}`).toString("base64");
  const body = new URLSearchParams({
    from: config.from_name ? `${config.from_name} <${config.from_email}>` : config.from_email,
    to: opts.to,
    subject: opts.subject,
    html: opts.htmlBody,
    text: opts.plainBody || opts.subject,
  });
  const res = await fetch(`https://${region}/v3/${domain}/messages`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Mailgun error: ${res.status}`);
}

async function sendViaPostmark(config: OrgEmailConfig, opts: SendEmailOptions) {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "X-Postmark-Server-Token": config.api_key!, "Content-Type": "application/json" },
    body: JSON.stringify({
      From: config.from_name ? `${config.from_name} <${config.from_email}>` : config.from_email,
      To: opts.to,
      Subject: opts.subject,
      HtmlBody: opts.htmlBody,
      TextBody: opts.plainBody,
    }),
  });
  if (!res.ok) throw new Error(`Postmark error: ${res.status}`);
}

async function sendViaSmtp(config: OrgEmailConfig, opts: SendEmailOptions) {
  const transporter = nodemailer.createTransport({
    host: config.smtp_host!,
    port: config.smtp_port ?? 587,
    secure: config.smtp_secure ?? false,
    auth: { user: config.smtp_user!, pass: config.smtp_pass! },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  const from = config.from_name ? `${config.from_name} <${config.from_email}>` : config.from_email;
  await transporter.sendMail({
    from,
    to: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
    subject: opts.subject,
    html: opts.htmlBody,
    text: opts.plainBody,
    replyTo: opts.replyTo,
  });
}

async function sendViaBrevo(config: OrgEmailConfig, opts: SendEmailOptions) {
  const from = config.from_name
    ? { name: config.from_name, email: config.from_email }
    : { email: config.from_email };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.api_key!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: [{ email: opts.to, name: opts.toName ?? opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlBody,
      textContent: opts.plainBody,
      replyTo: opts.replyTo ? { email: opts.replyTo } : undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }
}

async function sendViaMailtrap(config: OrgEmailConfig, opts: SendEmailOptions) {
  // Uses Mailtrap Email Testing API (HTTP) — works on Railway where SMTP ports are blocked
  // api_key = "Bearer <token>" or just "<token>", mailgun_domain field holds the inbox ID
  const token = config.api_key!;
  const inboxId = config.mailgun_domain; // we reuse mailgun_domain field to store inbox ID
  const url = inboxId
    ? `https://sandbox.api.mailtrap.io/api/send/${inboxId}`
    : "https://send.api.mailtrap.io/api/send";
  const from = config.from_name ? { email: config.from_email, name: config.from_name } : { email: config.from_email };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [{ email: opts.to, name: opts.toName }],
      subject: opts.subject,
      html: opts.htmlBody,
      text: opts.plainBody,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mailtrap error: ${err}`);
  }
}

/**
 * Send using an explicit config (used for testing a specific, possibly inactive config).
 */
export async function sendEmailWithConfig(config: OrgEmailConfig, opts: SendEmailOptions): Promise<boolean> {
  try {
    switch (config.provider) {
      case "resend":
        await sendViaResend({ apiKey: config.api_key!, from: config.from_email, fromName: config.from_name }, opts);
        return true;
      case "sendgrid":
        await sendViaSendGrid({ apiKey: config.api_key!, from: config.from_email, fromName: config.from_name }, opts);
        return true;
      case "mailgun":
        await sendViaMailgun(config, opts);
        return true;
      case "postmark":
        await sendViaPostmark(config, opts);
        return true;
      case "smtp":
        await sendViaSmtp(config, opts);
        return true;
      case "mailtrap":
        await sendViaMailtrap(config, opts);
        return true;
      case "brevo":
        await sendViaBrevo(config, opts);
        return true;
      default:
        return false;
    }
  } catch (err) {
    console.error("[emailSender] sendEmailWithConfig failed:", err);
    return false;
  }
}

/**
 * Send an email. Returns true if sent, false if no email provider configured (silently skipped).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  try {
    // 1. Try org's active email config
    const orgConfig = await getOrgEmailConfig(opts.orgId);

    if (orgConfig) {
      switch (orgConfig.provider) {
        case "resend":
          await sendViaResend({ apiKey: orgConfig.api_key!, from: orgConfig.from_email, fromName: orgConfig.from_name }, opts);
          return true;
        case "sendgrid":
          await sendViaSendGrid({ apiKey: orgConfig.api_key!, from: orgConfig.from_email, fromName: orgConfig.from_name }, opts);
          return true;
        case "mailgun":
          await sendViaMailgun(orgConfig, opts);
          return true;
        case "postmark":
          await sendViaPostmark(orgConfig, opts);
          return true;
        case "smtp":
          await sendViaSmtp(orgConfig, opts);
          return true;
        case "mailtrap":
          await sendViaMailtrap(orgConfig, opts);
          return true;
        case "brevo":
          await sendViaBrevo(orgConfig, opts);
          return true;
      }
    }

    // 2. Fall back to platform-level email config (set by superadmin)
    const platformConfig = await getPlatformEmailConfig();
    if (platformConfig) {
      return await sendEmailWithConfig(platformConfig, opts);
    }

    // 3. Fall back to env var Resend (legacy)
    const appApiKey = process.env.RESEND_API_KEY;
    const appFrom   = process.env.EMAIL_FROM || "noreply@flowmakeapp.com";
    const appName   = process.env.EMAIL_FROM_NAME || "FlowMake";

    if (appApiKey) {
      await sendViaResend({ apiKey: appApiKey, from: appFrom, fromName: appName }, opts);
      return true;
    }

    // 4. No email configured — silently skip
    console.warn(`[emailSender] No email provider configured for org ${opts.orgId}. Skipping email to ${opts.to}.`);
    return false;
  } catch (err) {
    console.error("[emailSender] Failed to send email:", err);
    return false;
  }
}

/**
 * Fetch an email template, interpolate variables, and return subject + html + plain.
 */
export async function renderEmailTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<{ subject: string; htmlBody: string; plainBody: string } | null> {
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await admin
    .from("email_templates")
    .select("subject, html_body, plain_body, blocks, settings")
    .eq("id", templateId)
    .single();

  if (!data) return null;

  let htmlBody  = data.html_body  || "";
  let plainBody = data.plain_body || "";

  // If html_body is empty (template never saved after editing), render from blocks on the fly
  if (!htmlBody && Array.isArray(data.blocks) && data.blocks.length > 0) {
    const { renderTemplateHtml, renderTemplatePlain, DEFAULT_SETTINGS } = await import("./emailTemplateRenderer");
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    htmlBody  = renderTemplateHtml(data.blocks, settings);
    plainBody = renderTemplatePlain(data.blocks);
  }

  return {
    subject:   interpolateVariables(data.subject  || "", variables),
    htmlBody:  interpolateVariables(htmlBody,          variables),
    plainBody: interpolateVariables(plainBody,         variables),
  };
}
