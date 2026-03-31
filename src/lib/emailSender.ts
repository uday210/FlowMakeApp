/**
 * Unified email sender.
 * Priority: org active config → app-level Resend env vars → skip (no email configured)
 */

import { createClient } from "@supabase/supabase-js";
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
      }
    }

    // 2. Fall back to app-level Resend
    const appApiKey = process.env.RESEND_API_KEY;
    const appFrom   = process.env.EMAIL_FROM || "noreply@flowmakeapp.com";
    const appName   = process.env.EMAIL_FROM_NAME || "FlowMake";

    if (appApiKey) {
      await sendViaResend({ apiKey: appApiKey, from: appFrom, fromName: appName }, opts);
      return true;
    }

    // 3. No email configured — silently skip
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
    .select("subject, html_body, plain_body")
    .eq("id", templateId)
    .single();

  if (!data) return null;

  return {
    subject:   interpolateVariables(data.subject   || "", variables),
    htmlBody:  interpolateVariables(data.html_body  || "", variables),
    plainBody: interpolateVariables(data.plain_body || "", variables),
  };
}
