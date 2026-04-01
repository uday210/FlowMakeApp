import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_slack": async ({ config, interpolate }) => {
    const slackAction = (config.action as string) || "send_webhook";
    const slackToken = config.token as string;
    const slackChannel = interpolate(config.channel as string || "");
    const slackMessage = interpolate(config.message as string || "");

    if (slackAction === "send_webhook") {
      const webhookUrl = interpolate(config.webhook_url as string);
      if (!webhookUrl) throw new Error("Slack webhook URL is required");
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slackMessage }),
      });
      if (!res.ok) throw new Error(`Slack responded with ${res.status}`);
      return { sent: true };
    } else if (slackAction === "post_message") {
      if (!slackToken) throw new Error("Bot token is required");
      if (!slackChannel) throw new Error("Channel is required");
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: slackChannel, text: slackMessage }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { sent: true, ts: d.ts, channel: d.channel };
    } else if (slackAction === "update_message") {
      if (!slackToken) throw new Error("Bot token is required");
      const ts = config.timestamp as string;
      if (!slackChannel || !ts) throw new Error("Channel and timestamp are required");
      const res = await fetch("https://slack.com/api/chat.update", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: slackChannel, ts, text: slackMessage }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { updated: true, ts: d.ts };
    } else if (slackAction === "delete_message") {
      if (!slackToken) throw new Error("Bot token is required");
      const ts = config.timestamp as string;
      if (!slackChannel || !ts) throw new Error("Channel and timestamp are required");
      const res = await fetch("https://slack.com/api/chat.delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: slackChannel, ts }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { deleted: true };
    } else if (slackAction === "add_reaction") {
      if (!slackToken) throw new Error("Bot token is required");
      const ts = config.timestamp as string;
      const reaction = config.reaction as string;
      if (!slackChannel || !ts || !reaction) throw new Error("Channel, timestamp, and reaction are required");
      const res = await fetch("https://slack.com/api/reactions.add", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: slackChannel, timestamp: ts, name: reaction }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { reacted: true, reaction };
    } else if (slackAction === "list_channels") {
      if (!slackToken) throw new Error("Bot token is required");
      const res = await fetch("https://slack.com/api/conversations.list?limit=100&types=public_channel,private_channel", {
        headers: { Authorization: `Bearer ${slackToken}` },
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { channels: d.channels?.map((c: Record<string, unknown>) => ({ id: c.id, name: c.name, is_private: c.is_private })), count: d.channels?.length };
    } else if (slackAction === "upload_file") {
      if (!slackToken) throw new Error("Bot token is required");
      const fileContent = config.file_content as string || "";
      const fileName = (config.file_name as string) || "file.txt";
      const form = new FormData();
      form.append("channels", slackChannel);
      form.append("content", fileContent);
      form.append("filename", fileName);
      const res = await fetch("https://slack.com/api/files.upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}` },
        body: form,
      });
      const d = await res.json();
      if (!d.ok) throw new Error(`Slack: ${d.error}`);
      return { uploaded: true, file_id: d.file?.id, file_name: d.file?.name };
    }
    return undefined;
  },

  "action_discord": async ({ config }) => {
    const webhookUrl = config.webhook_url as string;
    const message = config.message as string;
    const username = (config.username as string) || "FlowMake";
    if (!webhookUrl) throw new Error("Discord webhook URL is required");
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message, username }),
    });
    if (!res.ok) throw new Error(`Discord responded with ${res.status}`);
    return { sent: true, username };
  },

  "action_telegram": async ({ config }) => {
    const botToken = config.bot_token as string;
    const chatId = config.chat_id as string;
    const message = config.message as string;
    if (!botToken) throw new Error("Bot token is required");
    if (!chatId) throw new Error("Chat ID is required");
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      }
    );
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
    return { sent: true, message_id: data.result?.message_id };
  },

  "action_whatsapp": async ({ config, ctx }) => {
    const accessToken = config.access_token as string;
    const phoneNumberId = config.phone_number_id as string;
    if (!accessToken || !phoneNumberId) throw new Error("Access token and phone number ID are required");
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
    const to = localInterp(config.to as string || "").replace(/\D/g, "");
    const message = localInterp(config.message as string || "");
    if (!to || !message) throw new Error("To and message are required");
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: { message: string } }).error?.message || `WhatsApp ${res.status}`);
    }
    const d = await res.json();
    return { sent: true, message_id: d.messages?.[0]?.id, to };
  },

  "action_teams": async ({ config, interpolate }) => {
    const webhookUrl = config.webhook_url as string;
    if (!webhookUrl) throw new Error("Microsoft Teams webhook URL is required");
    const body: Record<string, unknown> = { "@type": "MessageCard", "@context": "http://schema.org/extensions", text: interpolate(config.message as string || "") };
    if (config.title) body.title = config.title;
    if (config.color) body.themeColor = config.color;
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Teams responded with ${res.status}`);
    return { sent: true };
  },

  "action_zoom": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "create_meeting";
    const userId = config.user_id as string || "me";
    if (!token) throw new Error("Zoom access token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "create_meeting") {
      const body: Record<string, unknown> = { topic: interpolate(config.topic as string || "Meeting"), type: 2 };
      if (config.start_time) body.start_time = config.start_time;
      if (config.duration) body.duration = parseInt(config.duration as string);
      const res = await fetch(`https://api.zoom.us/v2/users/${userId}/meetings`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Zoom ${res.status}`);
      return data;
    } else if (action === "get_meeting") {
      const res = await fetch(`https://api.zoom.us/v2/meetings/${config.meeting_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Zoom ${res.status}`);
      return data;
    } else if (action === "delete_meeting") {
      const res = await fetch(`https://api.zoom.us/v2/meetings/${config.meeting_id}`, { method: "DELETE", headers: hdrs });
      return { deleted: res.ok };
    }
    return undefined;
  },

  "action_vonage": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const apiSecret = config.api_secret as string;
    if (!apiKey || !apiSecret) throw new Error("Vonage API key and secret are required");
    const body = { from: config.from, to: interpolate(config.to as string || ""), text: interpolate(config.text as string || ""), api_key: apiKey, api_secret: apiSecret };
    const res = await fetch("https://rest.nexmo.com/sms/json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.messages?.[0]?.status !== "0") throw new Error(data.messages?.[0]?.["error-text"] || "Vonage SMS failed");
    return { sent: true, message_id: data.messages?.[0]?.["message-id"] };
  },

  "action_twilio": async ({ config }) => {
    const accountSid = config.account_sid as string;
    const authToken = config.auth_token as string;
    const from = config.from as string;
    const to = config.to as string;
    const message = config.message as string;
    if (!accountSid || !authToken || !from || !to) throw new Error("Account SID, auth token, from, and to are required");
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({ From: from, To: to, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Twilio ${res.status}`);
    return { sid: data.sid, status: data.status, to: data.to };
  },

  "action_notification": async ({ config, ctx }) => {
    const channel = (config.channel as string) || "slack";
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
    const message = localInterp((config.message as string) || "Workflow notification");
    if (channel === "slack") {
      const webhookUrl = config.webhook_url as string;
      if (!webhookUrl) throw new Error("Slack webhook URL is required");
      const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message }) });
      if (!res.ok) throw new Error(`Slack notification ${res.status}`);
      return { sent: true, channel: "slack" };
    } else {
      const emailTo = config.email_to as string;
      const smtpHost = config.smtp_host as string;
      const smtpUser = config.smtp_user as string;
      const smtpPass = config.smtp_pass as string;
      if (!emailTo || !smtpHost || !smtpUser || !smtpPass) throw new Error("Email, SMTP host, user, and password are required");
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({ host: smtpHost, port: 587, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({ from: smtpUser, to: emailTo, subject: "FlowMake Notification", text: message });
      return { sent: true, channel: "email", to: emailTo };
    }
  },

  "action_approval": async ({ config, ctx }) => {
    const approverEmail = config.approver_email as string;
    if (!approverEmail) throw new Error("Approver email is required");
    const { createServerClient } = await import("../supabase");
    const supabase = createServerClient();
    const { v4: uuidv4 } = await import("uuid");
    const token = uuidv4();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const approveUrl = `${baseUrl}/api/approvals/${token}?decision=approved`;
    const rejectUrl = `${baseUrl}/api/approvals/${token}?decision=rejected`;
    // Save approval record
    await supabase.from("workflow_approvals").insert({
      workflow_id: ctx.workflowId || null,
      token,
      status: "pending",
      approver_email: approverEmail,
    });
    // Send email via nodemailer
    const nodemailer = await import("nodemailer");
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
    const subject = localInterp((config.subject as string) || "Action required: workflow approval");
    const message = localInterp((config.message as string) || "");
    const smtpHost = config.smtp_host as string;
    const smtpUser = config.smtp_user as string;
    const smtpPass = config.smtp_pass as string;
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({ host: smtpHost, port: 587, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({
        from: smtpUser,
        to: approverEmail,
        subject,
        html: `<p>${message}</p><br><a href="${approveUrl}" style="background:#22c55e;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:8px">✓ Approve</a><a href="${rejectUrl}" style="background:#ef4444;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">✗ Reject</a>`,
      });
    }
    return { token, approve_url: approveUrl, reject_url: rejectUrl, approver_email: approverEmail, status: "pending" };
  },
};
