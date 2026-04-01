import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_email": async ({ config, interpolate }) => {
    // Legacy stub — use action_smtp, action_sendgrid, action_resend, etc. for real sending
    const to = interpolate(config.to as string);
    const subject = interpolate(config.subject as string);
    const body = interpolate(config.body as string);
    if (!to || !subject) throw new Error("To and Subject are required");
    console.log(`[Email stub] To: ${to}, Subject: ${subject}\n${body}`);
    return { sent: true, to, subject, simulated: true };
  },

  "action_sendgrid": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const from = config.from as string;
    const to = interpolate(config.to as string);
    const subject = interpolate(config.subject as string);
    const bodyText = interpolate((config.body as string) || "");
    if (!apiKey || !from || !to || !subject) throw new Error("API key, from, to, and subject are required");
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: bodyText.startsWith("<") ? "text/html" : "text/plain", value: bodyText }],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { errors?: { message: string }[] }).errors?.[0]?.message || `SendGrid ${res.status}`);
    }
    return { sent: true, to, subject };
  },

  "action_resend": async ({ config, ctx }) => {
    const apiKey = config.api_key as string;
    const from = config.from as string;
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const to = localInterp(config.to as string);
    const subject = localInterp(config.subject as string);
    const bodyText = localInterp((config.body as string) || "");
    if (!apiKey || !from || !to || !subject) throw new Error("API key, from, to, and subject are required");
    const isHtml = bodyText.trim().startsWith("<");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, ...(isHtml ? { html: bodyText } : { text: bodyText }) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { message?: string }).message || `Resend ${res.status}`);
    }
    const d = await res.json();
    return { sent: true, id: d.id, to, subject };
  },

  "action_mailgun": async ({ config, ctx }) => {
    const apiKey = config.api_key as string;
    const domain = config.domain as string;
    const from = config.from as string;
    const region = (config.region as string) || "us";
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const to = localInterp(config.to as string);
    const subject = localInterp(config.subject as string);
    const bodyText = localInterp((config.body as string) || "");
    if (!apiKey || !domain || !from || !to || !subject) throw new Error("API key, domain, from, to, and subject are required");
    const baseHost = region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
    const auth = Buffer.from(`api:${apiKey}`).toString("base64");
    const form = new URLSearchParams();
    form.append("from", from);
    form.append("to", to);
    form.append("subject", subject);
    if (bodyText.trim().startsWith("<")) {
      form.append("html", bodyText);
    } else {
      form.append("text", bodyText);
    }
    const res = await fetch(`https://${baseHost}/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { message?: string }).message || `Mailgun ${res.status}`);
    }
    const d = await res.json();
    return { sent: true, id: d.id, to, subject };
  },

  "action_postmark": async ({ config, ctx }) => {
    const serverToken = config.server_token as string;
    const from = config.from as string;
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const localInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const to = localInterp(config.to as string);
    const subject = localInterp(config.subject as string);
    const bodyText = localInterp((config.body as string) || "");
    if (!serverToken || !from || !to || !subject) throw new Error("Server token, from, to, and subject are required");
    const isHtml = bodyText.trim().startsWith("<");
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": serverToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: from,
        To: to,
        Subject: subject,
        ...(isHtml ? { HtmlBody: bodyText } : { TextBody: bodyText }),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { Message?: string }).Message || `Postmark ${res.status}`);
    }
    const d = await res.json();
    return { sent: true, message_id: d.MessageID, to, subject };
  },

  "action_smtp": async ({ config, interpolate }) => {
    const nodemailer = await import("nodemailer");
    const host = config.host as string;
    const port = Number(config.port) || 587;
    const secure = config.secure === "true";
    const user = config.user as string;
    const pass = config.pass as string;
    const from = (config.from as string) || user;
    const to = interpolate(config.to as string);
    const subject = interpolate(config.subject as string);
    const bodyText = interpolate((config.body as string) || "");
    if (!host || !user || !pass || !to || !subject) throw new Error("Host, user, password, to, and subject are required");
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const isHtml = bodyText.trim().startsWith("<");
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      ...(isHtml ? { html: bodyText } : { text: bodyText }),
    });
    return { sent: true, message_id: info.messageId, to, subject };
  },

  "action_send_email_template": async ({ config, ctx, interpolate }) => {
    const { sendEmail, renderEmailTemplate } = await import("../emailSender");
    const templateId = interpolate(config.template_id as string);
    const to         = interpolate(config.to as string);
    const toName     = interpolate((config.to_name as string) || "");
    const subjectOverride = interpolate((config.subject_override as string) || "");
    if (!templateId) throw new Error("Email template is required");
    if (!to) throw new Error("To email is required");
    // Build variables from all node outputs for interpolation inside the template
    const allVars: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...ctx.triggerData, ...ctx.nodeOutputs })) {
      if (typeof v === "object" && v !== null) {
        for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
          allVars[`${k}.${fk}`] = String(fv ?? "");
          allVars[fk] = String(fv ?? "");
        }
      } else {
        allVars[k] = String(v ?? "");
      }
    }
    const rendered = await renderEmailTemplate(templateId, allVars);
    if (!rendered) throw new Error("Email template not found or failed to render");
    const sent = await sendEmail({
      orgId: ctx.orgId || "",
      to,
      toName: toName || undefined,
      subject: subjectOverride || rendered.subject,
      htmlBody: rendered.htmlBody,
      plainBody: rendered.plainBody,
    });
    if (!sent) throw new Error("Failed to send email — check your org email provider configuration");
    return { sent: true, to, subject: subjectOverride || rendered.subject, template_id: templateId };
  },

  "action_mailchimp": async ({ config }) => {
    const apiKey = config.api_key as string;
    const serverPrefix = (config.server_prefix as string) || "us1";
    if (!apiKey) throw new Error("API key is required");
    const mcAction = (config.action as string) || "subscribe";
    const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
    const mcHeaders = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const mcBase = `https://${serverPrefix}.api.mailchimp.com/3.0`;
    const { createHash } = await import("crypto");
    const subscriberHash = (email: string) => createHash("md5").update(email.toLowerCase()).digest("hex");

    if (mcAction === "subscribe") {
      const listId = config.list_id as string;
      const email = config.email as string;
      if (!listId || !email) throw new Error("List ID and email are required");
      let mergeFields: Record<string, unknown> = {};
      try { mergeFields = JSON.parse((config.merge_fields as string) || "{}"); } catch { /* empty */ }
      const res = await fetch(`${mcBase}/lists/${listId}/members/${subscriberHash(email)}`, {
        method: "PUT", headers: mcHeaders,
        body: JSON.stringify({ email_address: email, status_if_new: config.status || "subscribed", status: config.status || "subscribed", merge_fields: mergeFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
      return { id: data.id, email: data.email_address, status: data.status };
    } else if (mcAction === "unsubscribe") {
      const listId = config.list_id as string;
      const email = config.email as string;
      if (!listId || !email) throw new Error("List ID and email are required");
      const res = await fetch(`${mcBase}/lists/${listId}/members/${subscriberHash(email)}`, {
        method: "PATCH", headers: mcHeaders, body: JSON.stringify({ status: "unsubscribed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
      return { email: data.email_address, status: data.status };
    } else if (mcAction === "get_subscriber") {
      const listId = config.list_id as string;
      const email = config.email as string;
      if (!listId || !email) throw new Error("List ID and email are required");
      const res = await fetch(`${mcBase}/lists/${listId}/members/${subscriberHash(email)}`, { headers: mcHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
      return { id: data.id, email: data.email_address, status: data.status, merge_fields: data.merge_fields, tags: data.tags };
    } else if (mcAction === "add_tag") {
      const listId = config.list_id as string;
      const email = config.email as string;
      const tagName = config.tag_name as string;
      if (!listId || !email || !tagName) throw new Error("List ID, email, and tag name are required");
      const res = await fetch(`${mcBase}/lists/${listId}/members/${subscriberHash(email)}/tags`, {
        method: "POST", headers: mcHeaders,
        body: JSON.stringify({ tags: [{ name: tagName, status: "active" }] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Mailchimp ${res.status}`);
      }
      return { tagged: true, email, tag: tagName };
    } else if (mcAction === "list_lists") {
      const res = await fetch(`${mcBase}/lists?count=50`, { headers: mcHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
      return { lists: data.lists?.map((l: Record<string, unknown>) => ({ id: l.id, name: l.name, member_count: (l.stats as Record<string, unknown>)?.member_count })), count: data.total_items };
    } else if (mcAction === "get_campaign_stats") {
      const campaignId = config.campaign_id as string;
      if (!campaignId) throw new Error("Campaign ID is required");
      const res = await fetch(`${mcBase}/reports/${campaignId}`, { headers: mcHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
      return { id: data.id, subject_line: data.subject_line, emails_sent: data.emails_sent, opens: data.opens, clicks: data.clicks, unsubscribes: data.unsubscribes };
    }
    return undefined;
  },

  "action_aws_ses": async ({ config, interpolate }) => {
    // Uses AWS Signature V4 — simplified via raw HTTPS call with query-string auth
    const accessKey = config.access_key_id as string;
    const secretKey = config.secret_access_key as string;
    const region = (config.region as string) || "us-east-1";
    if (!accessKey || !secretKey) throw new Error("AWS Access Key ID and Secret are required");
    // Build raw SES SendEmail request (query-string API, simpler than JSON for V4 signing)
    const toEmail = interpolate(config.to as string || "");
    const fromEmail = config.from as string;
    const subject = interpolate(config.subject as string || "");
    const bodyHtml = interpolate(config.body_html as string || "");
    const bodyText = interpolate(config.body_text as string || "");
    // Use AWS SDK-style date
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);
    const host = `email.${region}.amazonaws.com`;
    const params = new URLSearchParams({ Action: "SendEmail", "Source": fromEmail, "Destination.ToAddresses.member.1": toEmail, "Message.Subject.Data": subject, "Message.Body.Html.Data": bodyHtml, "Message.Body.Text.Data": bodyText });
    // Simple HMAC-SHA256 signing helper
    const enc = new TextEncoder();
    const sign = async (key: ArrayBuffer | Uint8Array<ArrayBuffer>, msg: string) => {
      const raw: ArrayBuffer = key instanceof Uint8Array ? key.buffer as ArrayBuffer : key;
      const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg))) as Uint8Array<ArrayBuffer>;
    };
    const getSigningKey = async () => {
      const kDate = await sign(enc.encode(`AWS4${secretKey}`), dateStamp);
      const kRegion = await sign(kDate, region);
      const kService = await sign(kRegion, "ses");
      return sign(kService, "aws4_request");
    };
    const payloadHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(params.toString())))).map(b => b.toString(16).padStart(2, "0")).join("");
    const canonicalReq = `POST\n/\n\ncontent-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n\ncontent-type;host;x-amz-date\n${payloadHash}`;
    const credScope = `${dateStamp}/${region}/ses/aws4_request`;
    const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(canonicalReq)))).map(b => b.toString(16).padStart(2, "0")).join("")}`;
    const signingKey = await getSigningKey();
    const sig = Array.from(await sign(signingKey, strToSign)).map(b => b.toString(16).padStart(2, "0")).join("");
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=content-type;host;x-amz-date, Signature=${sig}`;
    const res = await fetch(`https://${host}/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amzDate, Authorization: authHeader, Host: host }, body: params.toString() });
    const text = await res.text();
    if (!res.ok) throw new Error(`AWS SES ${res.status}: ${text}`);
    return { sent: true };
  },
};
