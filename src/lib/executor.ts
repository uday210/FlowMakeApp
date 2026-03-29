import type { WorkflowNode, WorkflowEdge, ExecutionLog } from "./types";
import { createServerClient } from "./supabase";

export interface ExecutionContext {
  triggerData: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
  logs: ExecutionLog[];
  workflowId?: string;
  variables: Record<string, unknown>;
  secrets: Record<string, string>;
}

async function executeNodeOnce(
  node: WorkflowNode,
  ctx: ExecutionContext,
  connections: Record<string, Record<string, unknown>>,
  log: ExecutionLog,
  start: number
): Promise<unknown> {
  const { type } = node.data;
    let output: unknown;

    // Merge connection credentials into config if a connectionId is set
    const effectiveConfig: Record<string, unknown> = { ...node.data.config };
    if (node.data.config.connectionId && connections[node.data.config.connectionId as string]) {
      Object.assign(effectiveConfig, connections[node.data.config.connectionId as string]);
    }
    const config = effectiveConfig;

    switch (type) {
      case "trigger_manual":
      case "trigger_webhook":
      case "trigger_schedule":
      case "trigger_interval":
      case "trigger_github_event":
      case "trigger_stripe":
      case "trigger_form":
      case "trigger_email_inbound":
      case "trigger_rss_poll":
        output = ctx.triggerData;
        break;


      case "action_http": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const url = interpolate(config.url as string);
        if (!url) throw new Error("URL is required");
        const method = (config.method as string) || "GET";
        let headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.headers) {
          try {
            const parsed = JSON.parse(interpolate(config.headers as string));
            headers = { ...headers, ...parsed };
          } catch {
            // ignore invalid JSON headers
          }
        }
        const fetchOptions: RequestInit = { method, headers };
        const rawBody = config.body as string;
        if (rawBody && method !== "GET" && method !== "DELETE") {
          fetchOptions.body = interpolate(rawBody);
        } else if (!rawBody && method !== "GET" && method !== "DELETE") {
          // Auto-forward all trigger + upstream data if no body specified
          fetchOptions.body = JSON.stringify(allData);
        }
        const res = await fetch(url, fetchOptions);
        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await res.json()
          : await res.text();
        output = { status: res.status, ok: res.ok, data };
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
        break;
      }

      case "action_email": {
        // Legacy stub — use action_smtp, action_sendgrid, action_resend, etc. for real sending
        const { to, subject, body } = config as { to: string; subject: string; body: string };
        if (!to || !subject) throw new Error("To and Subject are required");
        console.log(`[Email stub] To: ${to}, Subject: ${subject}\n${body}`);
        output = { sent: true, to, subject, simulated: true };
        break;
      }

      case "action_slack": {
        const webhookUrl = config.webhook_url as string;
        const message = config.message as string;
        if (!webhookUrl) throw new Error("Slack webhook URL is required");
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        });
        if (!res.ok) throw new Error(`Slack responded with ${res.status}`);
        output = { sent: true };
        break;
      }

      case "action_discord": {
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
        output = { sent: true, username };
        break;
      }

      case "action_telegram": {
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
        output = { sent: true, message_id: data.result?.message_id };
        break;
      }

      case "action_openai": {
        const apiKey = config.api_key as string;
        const model = (config.model as string) || "gpt-4o-mini";
        const prompt = config.prompt as string;
        const system = (config.system as string) || "";
        if (!apiKey) throw new Error("OpenAI API key is required");
        if (!prompt) throw new Error("Prompt is required");
        const messages = [];
        if (system) messages.push({ role: "system", content: system });
        messages.push({ role: "user", content: prompt });
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, messages }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
        const reply = data.choices?.[0]?.message?.content ?? "";
        output = { reply, model, usage: data.usage };
        break;
      }

      case "action_delay": {
        const seconds = Math.min(Number(config.seconds) || 1, 60);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        output = { waited_seconds: seconds };
        break;
      }

      case "action_filter": {
        const field = config.field as string;
        const operator = config.operator as string;
        const value = config.value as string;
        if (!field) throw new Error("Field is required");

        // Resolve field value from previous node outputs or trigger data
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const fieldValue = field.split(".").reduce<unknown>((obj, key) => {
          if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
          return undefined;
        }, allData);

        let passed = false;
        switch (operator) {
          case "equals":      passed = String(fieldValue) === value; break;
          case "not_equals":  passed = String(fieldValue) !== value; break;
          case "contains":    passed = String(fieldValue).includes(value); break;
          case "gt":          passed = Number(fieldValue) > Number(value); break;
          case "lt":          passed = Number(fieldValue) < Number(value); break;
          case "exists":      passed = fieldValue !== undefined && fieldValue !== null; break;
          default:            passed = false;
        }

        if (!passed) throw new Error(`Filter failed: "${field}" ${operator} "${value}" was false`);
        output = { passed: true, field, fieldValue };
        break;
      }

      case "action_if_else": {
        const field = config.field as string;
        const operator = config.operator as string;
        const value = config.value as string;
        if (!field) throw new Error("Field is required");

        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const fieldValue = field.split(".").reduce<unknown>((obj, key) => {
          if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
          return undefined;
        }, allData);

        let matched = false;
        switch (operator) {
          case "equals":     matched = String(fieldValue) === value; break;
          case "not_equals": matched = String(fieldValue) !== value; break;
          case "contains":   matched = String(fieldValue).includes(value); break;
          case "gt":         matched = Number(fieldValue) > Number(value); break;
          case "lt":         matched = Number(fieldValue) < Number(value); break;
          case "exists":     matched = fieldValue !== undefined && fieldValue !== null; break;
        }

        output = { _branch: matched ? "true" : "false", matched, field, fieldValue, value };
        break;
      }

      case "action_switch": {
        const field = config.field as string;
        if (!field) throw new Error("Field is required");

        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const fieldValue = String(field.split(".").reduce<unknown>((obj, key) => {
          if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
          return undefined;
        }, allData) ?? "");

        let matchedHandle = "default";
        for (const k of ["case_1", "case_2", "case_3", "case_4"] as const) {
          if (config[k] && String(config[k]) === fieldValue) {
            matchedHandle = k;
            break;
          }
        }

        output = { _branch: matchedHandle, field, fieldValue };
        break;
      }

      case "action_transform": {
        const template = config.template as string;
        if (!template) throw new Error("Template is required");
        // Simple {{key}} interpolation from previous outputs + trigger data
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolated = template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
          const val = path.trim().split(".").reduce<unknown>((obj, key) => {
            if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
            return undefined;
          }, allData);
          return val !== undefined ? String(val) : "";
        });
        try {
          output = JSON.parse(interpolated);
        } catch {
          output = { result: interpolated };
        }
        break;
      }

      case "action_github": {
        const token = config.token as string;
        const action = config.action as string;
        const owner = config.owner as string;
        const repo = config.repo as string;
        if (!token || !owner || !repo) throw new Error("Token, owner, and repo are required");
        const ghHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "FlowMake" };
        if (action === "create_issue") {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: "POST", headers: ghHeaders,
            body: JSON.stringify({ title: config.title, body: config.body }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
          output = { number: data.number, url: data.html_url, title: data.title };
        } else if (action === "get_repo") {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
          output = { name: data.full_name, stars: data.stargazers_count, forks: data.forks_count, description: data.description };
        } else if (action === "list_issues") {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, { headers: ghHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
          output = { count: data.length, issues: data.map((i: Record<string, unknown>) => ({ number: i.number, title: i.title, url: i.html_url })) };
        }
        break;
      }

      case "action_notion": {
        const token = config.token as string;
        const databaseId = config.database_id as string;
        const title = config.title as string;
        if (!token || !databaseId || !title) throw new Error("Token, database ID, and title are required");
        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
              title: { title: [{ text: { content: title } }] },
            },
            children: config.content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: config.content } }] } }] : [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
        output = { page_id: data.id, url: data.url, title };
        break;
      }

      case "action_airtable": {
        const token = config.token as string;
        const baseId = config.base_id as string;
        const table = config.table as string;
        const fieldsRaw = config.fields as string;
        if (!token || !baseId || !table) throw new Error("Token, base ID, and table are required");
        let fields: Record<string, unknown> = {};
        try { fields = JSON.parse(fieldsRaw); } catch { throw new Error("Fields must be valid JSON"); }
        const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Airtable ${res.status}`);
        output = { record_id: data.id, fields: data.fields };
        break;
      }

      case "action_twilio": {
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
        output = { sid: data.sid, status: data.status, to: data.to };
        break;
      }

      case "action_sendgrid": {
        const apiKey = config.api_key as string;
        const from = config.from as string;
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
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
        output = { sent: true, to, subject };
        break;
      }

      case "action_resend": {
        const apiKey = config.api_key as string;
        const from = config.from as string;
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const to = interpolate(config.to as string);
        const subject = interpolate(config.subject as string);
        const bodyText = interpolate((config.body as string) || "");
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
        output = { sent: true, id: d.id, to, subject };
        break;
      }

      case "action_mailgun": {
        const apiKey = config.api_key as string;
        const domain = config.domain as string;
        const from = config.from as string;
        const region = (config.region as string) || "us";
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const to = interpolate(config.to as string);
        const subject = interpolate(config.subject as string);
        const bodyText = interpolate((config.body as string) || "");
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
        output = { sent: true, id: d.id, to, subject };
        break;
      }

      case "action_postmark": {
        const serverToken = config.server_token as string;
        const from = config.from as string;
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const to = interpolate(config.to as string);
        const subject = interpolate(config.subject as string);
        const bodyText = interpolate((config.body as string) || "");
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
        output = { sent: true, message_id: d.MessageID, to, subject };
        break;
      }

      case "action_smtp": {
        const nodemailer = await import("nodemailer");
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
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
        output = { sent: true, message_id: info.messageId, to, subject };
        break;
      }

      case "action_rss": {
        const url = config.url as string;
        const limit = Math.min(Number(config.limit) || 5, 20);
        if (!url) throw new Error("Feed URL is required");
        const res = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
        if (!res.ok) throw new Error(`Failed to fetch RSS feed: ${res.status}`);
        const xml = await res.text();
        const items: { title: string; link: string; pubDate: string }[] = [];
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
          if (items.length >= limit) break;
          const block = match[1];
          const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
          const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
          const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
          items.push({ title, link, pubDate });
        }
        output = { count: items.length, items };
        break;
      }

      case "action_datetime": {
        const action = (config.action as string) || "now";
        const format = (config.format as string) || "ISO";
        const timezone = (config.timezone as string) || "UTC";
        const inputDate = config.input ? new Date(config.input as string) : new Date();
        let date = action === "add"
          ? new Date(inputDate.getTime() + (Number(config.offset_days) || 0) * 86400000)
          : action === "format" ? inputDate : new Date();

        const formatDate = (d: Date) => {
          if (format === "unix") return Math.floor(d.getTime() / 1000);
          if (format === "date") return d.toLocaleDateString("en-CA", { timeZone: timezone });
          if (format === "time") return d.toLocaleTimeString("en-GB", { timeZone: timezone });
          if (format === "human") return d.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" });
          return d.toISOString();
        };
        output = { result: formatDate(date), timezone, format };
        break;
      }

      case "action_math": {
        const a = Number(config.a);
        const b = Number(config.b);
        const operation = config.operation as string;
        if (isNaN(a)) throw new Error("Value A must be a number");
        let result: number;
        switch (operation) {
          case "add":      result = a + b; break;
          case "subtract": result = a - b; break;
          case "multiply": result = a * b; break;
          case "divide":
            if (b === 0) throw new Error("Cannot divide by zero");
            result = a / b; break;
          case "modulo":
            if (b === 0) throw new Error("Cannot modulo by zero");
            result = a % b; break;
          case "power":    result = Math.pow(a, b); break;
          case "round":    result = Math.round(a); break;
          case "abs":      result = Math.abs(a); break;
          default: throw new Error(`Unknown operation: ${operation}`);
        }
        output = { result, a, b, operation };
        break;
      }

      case "action_claude": {
        const apiKey = config.api_key as string;
        const model = (config.model as string) || "claude-haiku-4-5-20251001";
        const prompt = config.prompt as string;
        const system = config.system as string;
        if (!apiKey) throw new Error("Anthropic API key is required");
        if (!prompt) throw new Error("Prompt is required");
        const body: Record<string, unknown> = { model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] };
        if (system) body.system = system;
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
        const reply = (data.content as { type: string; text: string }[])?.[0]?.text ?? "";
        output = { reply, model, input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens };
        break;
      }

      case "action_sheets": {
        const accessToken = config.access_token as string;
        const spreadsheetId = config.spreadsheet_id as string;
        const range = (config.range as string) || "Sheet1!A1";
        const valuesRaw = config.values as string;
        if (!accessToken || !spreadsheetId) throw new Error("Access token and spreadsheet ID are required");
        let values: unknown[][];
        try { values = JSON.parse(valuesRaw); } catch { throw new Error("Values must be a valid JSON array"); }
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Sheets ${res.status}`);
        output = { updated_range: data.updates?.updatedRange, rows_added: data.updates?.updatedRows };
        break;
      }

      case "trigger_salesforce":
      case "action_salesforce": {
        const env = (config.environment as string) || "production";
        const authFlow = (config.auth_flow as string) || "password";

        // Resolve login URL: custom domain takes priority, then environment preset
        const loginUrl = (() => {
          const custom = (config.login_url as string)?.trim().replace(/\/$/, "");
          if (custom) return custom;
          if (env === "sandbox") return "https://test.salesforce.com";
          return "https://login.salesforce.com";
        })();

        const clientId = config.client_id as string;
        const clientSecret = config.client_secret as string;
        if (!clientId || !clientSecret) throw new Error("Consumer Key and Secret are required");

        // Build token request params based on auth flow
        const tokenParams = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
        if (authFlow === "client_credentials") {
          tokenParams.set("grant_type", "client_credentials");
        } else {
          // Username + Password flow
          const username = config.username as string;
          const password = (config.password as string) + ((config.security_token as string) || "");
          if (!username) throw new Error("Username is required for password flow");
          tokenParams.set("grant_type", "password");
          tokenParams.set("username", username);
          tokenParams.set("password", password);
        }

        const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || `Salesforce auth failed: ${tokenRes.status}`);
        }
        const { access_token, instance_url } = tokenData as { access_token: string; instance_url: string };
        const sfHeaders = {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        };
        const apiBase = `${instance_url}/services/data/v59.0`;

        if (type === "trigger_salesforce") {
          // Polling trigger — fetch recent records based on event type
          const sfObject = (config.object as string) || "Lead";
          const event = (config.event as string) || "new_record";
          const filter = config.filter as string;
          const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 minutes

          let soql = "";
          if (event === "new_record" || event === "new_lead") {
            soql = `SELECT Id, Name, CreatedDate FROM ${sfObject} WHERE CreatedDate > ${since}`;
          } else if (event === "record_updated" || event === "opportunity_stage") {
            soql = `SELECT Id, Name, LastModifiedDate${event === "opportunity_stage" ? ", StageName" : ""} FROM ${sfObject} WHERE LastModifiedDate > ${since}`;
          }
          if (filter) soql += ` AND ${filter}`;
          soql += " LIMIT 50";

          const res = await fetch(`${apiBase}/query?q=${encodeURIComponent(soql)}`, { headers: sfHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data[0]?.message || `Salesforce query failed: ${res.status}`);
          output = {
            event,
            object: sfObject,
            total: data.totalSize,
            records: data.records,
          };
        } else {
          // action_salesforce
          const sfObject = (config.object as string) || "Lead";
          const action = (config.action as string) || "create";
          const recordId = config.record_id as string;

          if (action === "create") {
            let fields: Record<string, unknown> = {};
            try { fields = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
            const res = await fetch(`${apiBase}/sobjects/${sfObject}`, {
              method: "POST", headers: sfHeaders, body: JSON.stringify(fields),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data[0]?.message || `Create failed: ${res.status}`);
            output = { id: data.id, success: data.success, object: sfObject };

          } else if (action === "update") {
            if (!recordId) throw new Error("Record ID is required for update");
            let fields: Record<string, unknown> = {};
            try { fields = JSON.parse(config.fields as string); } catch { throw new Error("Fields must be valid JSON"); }
            const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, {
              method: "PATCH", headers: sfHeaders, body: JSON.stringify(fields),
            });
            if (res.status === 204) {
              output = { success: true, id: recordId, object: sfObject };
            } else {
              const data = await res.json();
              throw new Error(data[0]?.message || `Update failed: ${res.status}`);
            }

          } else if (action === "get") {
            if (!recordId) throw new Error("Record ID is required");
            const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, { headers: sfHeaders });
            const data = await res.json();
            if (!res.ok) throw new Error(data[0]?.message || `Get failed: ${res.status}`);
            output = data;

          } else if (action === "query") {
            const soql = config.soql as string;
            if (!soql) throw new Error("SOQL query is required");
            const res = await fetch(`${apiBase}/query?q=${encodeURIComponent(soql)}`, { headers: sfHeaders });
            const data = await res.json();
            if (!res.ok) throw new Error(data[0]?.message || `Query failed: ${res.status}`);
            output = { total: data.totalSize, records: data.records, done: data.done };

          } else if (action === "delete") {
            if (!recordId) throw new Error("Record ID is required for delete");
            const res = await fetch(`${apiBase}/sobjects/${sfObject}/${recordId}`, {
              method: "DELETE", headers: sfHeaders,
            });
            if (res.status === 204) {
              output = { success: true, deleted_id: recordId };
            } else {
              const data = await res.json();
              throw new Error(data[0]?.message || `Delete failed: ${res.status}`);
            }
          }
        }
        break;
      }

      case "action_hubspot": {
        const apiKey = config.api_key as string;
        const action = config.action as string;
        const propertiesRaw = config.properties as string;
        if (!apiKey) throw new Error("HubSpot token is required");
        const hsHeaders = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
        let properties: Record<string, unknown> = {};
        try { properties = JSON.parse(propertiesRaw || "{}"); } catch { /* empty */ }

        if (action === "create_contact") {
          const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
            method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
          output = { id: data.id, type: "contact", properties: data.properties };
        } else if (action === "create_deal") {
          const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
            method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
          output = { id: data.id, type: "deal", properties: data.properties };
        } else if (action === "create_company") {
          const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
            method: "POST", headers: hsHeaders, body: JSON.stringify({ properties }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
          output = { id: data.id, type: "company", properties: data.properties };
        } else if (action === "update_contact") {
          const recordId = config.record_id as string;
          if (!recordId) throw new Error("Record ID is required for update");
          const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${recordId}`, {
            method: "PATCH", headers: hsHeaders, body: JSON.stringify({ properties }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
          output = { id: data.id, updated: true };
        } else if (action === "search_contacts") {
          const query = (properties.query as string) || "";
          const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
            method: "POST", headers: hsHeaders,
            body: JSON.stringify({ query, limit: 10, properties: ["email", "firstname", "lastname"] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HubSpot ${res.status}`);
          output = { total: data.total, results: data.results };
        }
        break;
      }

      case "action_jira": {
        const domain = config.domain as string;
        const email = config.email as string;
        const apiToken = config.api_token as string;
        const action = config.action as string;
        if (!domain || !email || !apiToken) throw new Error("Jira domain, email, and API token are required");
        const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
        const jiraHeaders = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };
        const baseUrl = `https://${domain}/rest/api/3`;

        if (action === "create_issue") {
          const projectKey = config.project_key as string;
          if (!projectKey) throw new Error("Project key is required");
          const res = await fetch(`${baseUrl}/issue`, {
            method: "POST", headers: jiraHeaders,
            body: JSON.stringify({
              fields: {
                project: { key: projectKey },
                summary: config.summary || "New issue",
                description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: String(config.description || "") }] }] },
                issuetype: { name: config.issue_type || "Task" },
              },
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
          output = { id: data.id, key: data.key, url: `https://${domain}/browse/${data.key}` };
        } else if (action === "get_issue") {
          const issueKey = config.issue_key as string;
          if (!issueKey) throw new Error("Issue key is required");
          const res = await fetch(`${baseUrl}/issue/${issueKey}`, { headers: jiraHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
          output = { id: data.id, key: data.key, summary: data.fields?.summary, status: data.fields?.status?.name };
        } else if (action === "add_comment") {
          const issueKey = config.issue_key as string;
          if (!issueKey) throw new Error("Issue key is required");
          const res = await fetch(`${baseUrl}/issue/${issueKey}/comment`, {
            method: "POST", headers: jiraHeaders,
            body: JSON.stringify({ body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: String(config.description || "") }] }] } }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.errorMessages?.[0] || `Jira ${res.status}`);
          output = { comment_id: data.id, issue_key: issueKey };
        }
        break;
      }

      case "action_linear": {
        const apiKey = config.api_key as string;
        const action = config.action as string;
        if (!apiKey) throw new Error("Linear API key is required");
        const linearHeaders = { Authorization: apiKey, "Content-Type": "application/json" };

        if (action === "create_issue") {
          const mutation = `mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int) {
            issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority }) {
              success issue { id identifier title url }
            }
          }`;
          const res = await fetch("https://api.linear.app/graphql", {
            method: "POST", headers: linearHeaders,
            body: JSON.stringify({ query: mutation, variables: { teamId: config.team_id, title: config.title, description: config.description || "", priority: Number(config.priority) || 0 } }),
          });
          const data = await res.json();
          if (data.errors) throw new Error(data.errors[0]?.message || "Linear error");
          const issue = data.data?.issueCreate?.issue;
          output = { id: issue?.id, key: issue?.identifier, title: issue?.title, url: issue?.url };
        } else if (action === "update_issue") {
          const issueId = config.issue_id as string;
          if (!issueId) throw new Error("Issue ID is required for update");
          const mutation = `mutation UpdateIssue($id: String!, $title: String, $description: String) {
            issueUpdate(id: $id, input: { title: $title, description: $description }) {
              success issue { id identifier title }
            }
          }`;
          const res = await fetch("https://api.linear.app/graphql", {
            method: "POST", headers: linearHeaders,
            body: JSON.stringify({ query: mutation, variables: { id: issueId, title: config.title, description: config.description } }),
          });
          const data = await res.json();
          if (data.errors) throw new Error(data.errors[0]?.message || "Linear error");
          output = { updated: true, id: issueId };
        }
        break;
      }

      case "action_stripe": {
        const secretKey = config.secret_key as string;
        const action = config.action as string;
        if (!secretKey) throw new Error("Stripe secret key is required");
        const stripeHeaders = { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" };

        if (action === "create_payment_intent") {
          const amount = Number(config.amount);
          if (!amount || isNaN(amount)) throw new Error("Amount is required");
          const body = new URLSearchParams({ amount: String(amount), currency: (config.currency as string) || "usd" });
          if (config.customer_id) body.append("customer", config.customer_id as string);
          const res = await fetch("https://api.stripe.com/v1/payment_intents", { method: "POST", headers: stripeHeaders, body: body.toString() });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
          output = { id: data.id, client_secret: data.client_secret, amount: data.amount, currency: data.currency, status: data.status };
        } else if (action === "get_payment_intent") {
          const piId = config.payment_intent_id as string;
          if (!piId) throw new Error("Payment Intent ID is required");
          const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, { headers: stripeHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
          output = { id: data.id, amount: data.amount, currency: data.currency, status: data.status };
        } else if (action === "create_customer") {
          const body = new URLSearchParams();
          if (config.customer_email) body.append("email", config.customer_email as string);
          if (config.customer_name) body.append("name", config.customer_name as string);
          const res = await fetch("https://api.stripe.com/v1/customers", { method: "POST", headers: stripeHeaders, body: body.toString() });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
          output = { id: data.id, email: data.email, name: data.name };
        } else if (action === "list_charges") {
          const res = await fetch("https://api.stripe.com/v1/charges?limit=10", { headers: stripeHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
          output = { count: data.data?.length, charges: data.data?.map((c: Record<string, unknown>) => ({ id: c.id, amount: c.amount, currency: c.currency, status: c.status })) };
        }
        break;
      }

      case "action_mailchimp": {
        const apiKey = config.api_key as string;
        const serverPrefix = (config.server_prefix as string) || "us1";
        const listId = config.list_id as string;
        const email = config.email as string;
        if (!apiKey || !listId || !email) throw new Error("API key, list ID, and email are required");
        const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
        const mcHeaders = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
        let mergeFields: Record<string, unknown> = {};
        try { mergeFields = JSON.parse((config.merge_fields as string) || "{}"); } catch { /* empty */ }
        const subscriberHash = require("crypto").createHash("md5").update(email.toLowerCase()).digest("hex");
        const res = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`, {
          method: "PUT", headers: mcHeaders,
          body: JSON.stringify({ email_address: email, status_if_new: config.status || "subscribed", status: config.status || "subscribed", merge_fields: mergeFields }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Mailchimp ${res.status}`);
        output = { id: data.id, email: data.email_address, status: data.status };
        break;
      }

      case "trigger_esign":
        output = ctx.triggerData;
        break;

      case "action_esign_request": {
        const signerEmail = config.signer_email as string;
        const signerName = (config.signer_name as string) || "";
        const documentTitle = (config.document_title as string) || "Document";
        const documentContent = (config.document_content as string) || "";
        const documentId = (config.document_id as string) || null;
        if (!signerEmail) throw new Error("Signer email is required");

        // If a document is selected, pull its title from DB
        const supabase = createServerClient();
        let resolvedTitle = documentTitle;
        if (documentId) {
          const { data: doc } = await supabase.from("esign_documents").select("name").eq("id", documentId).single();
          if (doc?.name) resolvedTitle = doc.name;
        }

        const { data: req, error } = await supabase
          .from("esign_requests")
          .insert({
            workflow_id: ctx.workflowId || null,
            document_id: documentId,
            document_title: resolvedTitle,
            document_content: documentId ? "" : documentContent,
            signer_email: signerEmail,
            signer_name: signerName,
            status: "pending",
          })
          .select()
          .single();

        if (error || !req) throw new Error(error?.message || "Failed to create signing request");

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const signingUrl = `${baseUrl}/sign/${req.token}`;

        output = {
          request_id: req.id,
          token: req.token,
          signing_url: signingUrl,
          signer_email: signerEmail,
          document_title: resolvedTitle,
          status: "pending",
        };
        break;
      }

      // ── Flow Control ──────────────────────────────────────────────────────────

      case "action_iterator": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const arrayPath = (config.array_path as string) || "";
        const maxItems = Math.min(Number(config.max_items) || 100, 1000);
        let items: unknown[] = [];
        try {
          const resolved = arrayPath.trim().split(".").reduce<unknown>((o, k) => {
            if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
            return undefined;
          }, allData);
          if (Array.isArray(resolved)) items = resolved;
          else if (typeof resolved === "string") items = JSON.parse(resolved);
          else if (typeof resolved === "object" && resolved !== null) items = Object.values(resolved as object);
        } catch { /* ignore */ }
        items = items.slice(0, maxItems);
        // Store items so downstream nodes can access them via {{nodeId.items}} etc.
        output = { items, count: items.length, first: items[0], last: items[items.length - 1] };
        break;
      }

      case "action_set_variable": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const name = config.name as string;
        const value = interpolate(config.value as string || "");
        if (!name) throw new Error("Variable name is required");
        ctx.variables[name] = value;
        output = { name, value, variables: { ...ctx.variables } };
        break;
      }

      case "action_get_variable": {
        const name = config.name as string;
        if (!name) throw new Error("Variable name is required");
        const value = ctx.variables[name] ?? (config.default_value as string ?? null);
        output = { name, value, found: name in ctx.variables };
        break;
      }

      case "action_sub_workflow": {
        const subId = config.workflow_id as string;
        if (!subId) throw new Error("Workflow ID is required");
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        let payload: Record<string, unknown> = {};
        if (config.payload) {
          try {
            const raw = (config.payload as string).replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
              const val = path.trim().split(".").reduce<unknown>((o, k) => {
                if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
                return undefined;
              }, allData);
              if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
            });
            payload = JSON.parse(raw);
          } catch { /* ignore */ }
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/execute/${subId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _trigger: "sub_workflow", caller_workflow_id: ctx.workflowId, ...payload }),
        });
        if (!res.ok) throw new Error(`Sub-workflow returned ${res.status}`);
        const data = await res.json();
        output = { triggered: true, workflow_id: subId, result: data };
        break;
      }

      case "action_webhook_response": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const status = Number(config.status) || 200;
        const contentType = (config.content_type as string) || "application/json";
        const body = interpolate((config.body as string) || "{}");
        // Store as special context value — the execute API route reads this to return custom responses
        ctx.nodeOutputs["__webhook_response__"] = { status, contentType, body };
        output = { status, body };
        break;
      }

      case "action_merge": {
        // Collect outputs from all incoming nodes and merge them into one object
        const merged: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(ctx.nodeOutputs)) {
          if (key.startsWith("__")) continue;
          Object.assign(merged, typeof val === "object" && val !== null ? val : { [key]: val });
        }
        output = { merged, node_outputs: ctx.nodeOutputs };
        break;
      }

      // ── Data Processing ───────────────────────────────────────────────────────

      case "action_code": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const code = (config.code as string) || "";
        if (!code.trim()) throw new Error("Code is required");
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function("input", "variables", `"use strict"; ${code}`);
          const result = await fn(allData, ctx.variables);
          output = result ?? { executed: true };
        } catch (err) {
          throw new Error(`Code error: ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }

      case "action_formatter": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const resolveVal = (v: string): unknown => {
          if (!v.includes("{{")) return v;
          return v.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        };
        const rawValue = resolveVal(config.value as string || "");
        const value = String(rawValue);
        const operation = config.operation as string;
        const extra = (config.extra as string) || "";
        let result: unknown;
        switch (operation) {
          case "uppercase": result = value.toUpperCase(); break;
          case "lowercase": result = value.toLowerCase(); break;
          case "capitalize": result = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); break;
          case "trim": result = value.trim(); break;
          case "truncate": result = value.slice(0, Number(extra) || 100); break;
          case "replace": {
            const [from, to] = extra.split(":");
            result = value.replaceAll(from || "", to || ""); break;
          }
          case "split": result = value.split(extra || ","); break;
          case "number_format": result = Number(value).toLocaleString(); break;
          case "round": result = Math.round(Number(value) * Math.pow(10, Number(extra) || 0)) / Math.pow(10, Number(extra) || 0); break;
          case "date_format": {
            const d = new Date(value);
            if (isNaN(d.getTime())) throw new Error("Invalid date");
            const fmt = extra || "YYYY-MM-DD";
            result = fmt
              .replace("YYYY", String(d.getFullYear()))
              .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
              .replace("DD", String(d.getDate()).padStart(2, "0"))
              .replace("HH", String(d.getHours()).padStart(2, "0"))
              .replace("mm", String(d.getMinutes()).padStart(2, "0"))
              .replace("ss", String(d.getSeconds()).padStart(2, "0"));
            break;
          }
          case "json_parse": result = JSON.parse(value); break;
          case "json_stringify": result = JSON.stringify(JSON.parse(value), null, 2); break;
          default: result = value;
        }
        output = { result, original: value, operation };
        break;
      }

      case "action_csv_parse": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const csv = interpolate(config.csv as string || "");
        const delimiter = (config.delimiter as string) || ",";
        const hasHeader = config.has_header !== "false";
        const lines = csv.trim().split(/\r?\n/);
        let rows: unknown[];
        if (hasHeader && lines.length > 0) {
          const headers = lines[0].split(delimiter).map((h) => h.trim());
          rows = lines.slice(1).map((line) => {
            const vals = line.split(delimiter);
            return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? ""]));
          });
        } else {
          rows = lines.map((line) => line.split(delimiter).map((v) => v.trim()));
        }
        output = { rows, count: rows.length };
        break;
      }

      case "action_csv_generate": {
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const delimiter = (config.delimiter as string) || ",";
        let data: unknown[];
        const raw = (config.data as string) || "";
        // Try to resolve as path first, then JSON
        if (raw.startsWith("{{")) {
          const path = raw.replace(/\{\{|\}\}/g, "").trim();
          const resolved = path.split(".").reduce<unknown>((o, k) => {
            if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
            return undefined;
          }, allData);
          data = Array.isArray(resolved) ? resolved : [];
        } else {
          try { data = JSON.parse(raw); } catch { data = []; }
        }
        if (!Array.isArray(data) || data.length === 0) { output = { csv: "", count: 0 }; break; }
        const headers = Object.keys(data[0] as Record<string, unknown>);
        const headerRow = headers.join(delimiter);
        const dataRows = data.map((row) =>
          headers.map((h) => {
            const v = (row as Record<string, unknown>)[h];
            const s = String(v ?? "");
            return s.includes(delimiter) || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(delimiter)
        );
        const csv = [headerRow, ...dataRows].join("\n");
        output = { csv, count: data.length, headers };
        break;
      }

      // ── AI additions ──────────────────────────────────────────────────────────

      case "action_dalle": {
        const apiKey = config.api_key as string;
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const prompt = interpolate(config.prompt as string || "");
        if (!apiKey || !prompt) throw new Error("API key and prompt are required");
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt,
            n: Math.min(Number(config.n) || 1, 4),
            size: (config.size as string) || "1024x1024",
            quality: (config.quality as string) || "standard",
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as { error?: { message: string } }).error?.message || `DALL-E ${res.status}`);
        }
        const d = await res.json();
        const images = (d.data as { url: string; revised_prompt?: string }[]);
        output = { url: images[0]?.url, images: images.map((i) => i.url), revised_prompt: images[0]?.revised_prompt };
        break;
      }

      // ── Storage ───────────────────────────────────────────────────────────────

      case "action_data_store": {
        const supabase = createServerClient();
        const workflowId = ctx.workflowId || "global";
        const action = config.action as string;
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const key = interpolate(config.key as string || "");
        if (action === "set") {
          const value = interpolate(config.value as string || "");
          await supabase.from("workflow_data_store").upsert({ workflow_id: workflowId, key, value }, { onConflict: "workflow_id,key" });
          output = { action: "set", key, value };
        } else if (action === "get") {
          const { data } = await supabase.from("workflow_data_store").select("value").eq("workflow_id", workflowId).eq("key", key).single();
          output = { action: "get", key, value: data?.value ?? null, found: !!data };
        } else if (action === "delete") {
          await supabase.from("workflow_data_store").delete().eq("workflow_id", workflowId).eq("key", key);
          output = { action: "delete", key };
        } else if (action === "list") {
          const { data } = await supabase.from("workflow_data_store").select("key,value").eq("workflow_id", workflowId);
          output = { action: "list", entries: data ?? [], count: data?.length ?? 0 };
        }
        break;
      }

      case "action_google_drive": {
        const accessToken = config.access_token as string;
        const action = config.action as string;
        if (!accessToken) throw new Error("Access token is required");
        const driveHeaders = { Authorization: `Bearer ${accessToken}` };
        if (action === "list") {
          const folderId = config.folder_id as string;
          const q = folderId ? `'${folderId}' in parents and trashed = false` : "trashed = false";
          const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)`, { headers: driveHeaders });
          if (!res.ok) throw new Error(`Drive list ${res.status}`);
          const d = await res.json();
          output = { files: d.files, count: d.files?.length ?? 0 };
        } else if (action === "upload") {
          const fileName = config.file_name as string || "file.txt";
          const content = config.file_content as string || "";
          const mimeType = config.mime_type as string || "text/plain";
          const meta = JSON.stringify({ name: fileName, ...(config.folder_id ? { parents: [config.folder_id] } : {}) });
          const form = new FormData();
          form.append("metadata", new Blob([meta], { type: "application/json" }));
          form.append("file", new Blob([content], { type: mimeType }));
          const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
            method: "POST", headers: driveHeaders, body: form,
          });
          if (!res.ok) throw new Error(`Drive upload ${res.status}`);
          const d = await res.json();
          output = { id: d.id, name: d.name, mimeType: d.mimeType };
        } else if (action === "get") {
          const fileId = config.file_id as string;
          if (!fileId) throw new Error("File ID is required");
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`, { headers: driveHeaders });
          if (!res.ok) throw new Error(`Drive get ${res.status}`);
          output = await res.json();
        } else if (action === "delete") {
          const fileId = config.file_id as string;
          if (!fileId) throw new Error("File ID is required");
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE", headers: driveHeaders });
          output = { deleted: true, file_id: fileId };
        }
        break;
      }

      case "action_s3": {
        const accessKeyId = config.access_key_id as string;
        const secretAccessKey = config.secret_access_key as string;
        const region = (config.region as string) || "us-east-1";
        const bucket = config.bucket as string;
        const action = config.action as string;
        const key = config.key as string;
        if (!accessKeyId || !secretAccessKey || !bucket) throw new Error("Access key, secret, and bucket are required");
        const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
        if (action === "put") {
          const body = config.body as string || "";
          const contentType = (config.content_type as string) || "text/plain";
          if (!key) throw new Error("Object key is required");
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
          output = { uploaded: true, bucket, key };
        } else if (action === "get") {
          if (!key) throw new Error("Object key is required");
          const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          const body = await res.Body?.transformToString();
          output = { bucket, key, body, content_type: res.ContentType };
        } else if (action === "delete") {
          if (!key) throw new Error("Object key is required");
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          output = { deleted: true, bucket, key };
        } else if (action === "list") {
          const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: key || undefined }));
          output = { objects: res.Contents?.map((o) => ({ key: o.Key, size: o.Size, last_modified: o.LastModified })) ?? [], count: res.KeyCount ?? 0 };
        }
        break;
      }

      // ── Productivity ──────────────────────────────────────────────────────────

      case "action_google_calendar": {
        const accessToken = config.access_token as string;
        const action = config.action as string;
        const calendarId = (config.calendar_id as string) || "primary";
        if (!accessToken) throw new Error("Access token is required");
        const calHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
        if (action === "list") {
          const maxResults = Number(config.max_results) || 10;
          const now = new Date().toISOString();
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(now)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
            { headers: calHeaders }
          );
          if (!res.ok) throw new Error(`Calendar list ${res.status}`);
          const d = await res.json();
          output = { events: d.items, count: d.items?.length ?? 0 };
        } else if (action === "create") {
          const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
          const interpolate = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, p: string) => {
            const v = p.trim().split(".").reduce<unknown>((o, k) => o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined, allData);
            return v !== undefined ? String(v) : "";
          });
          const attendees = ((config.attendees as string) || "").split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email }));
          const event = {
            summary: interpolate(config.summary as string || ""),
            description: interpolate(config.description as string || ""),
            start: { dateTime: interpolate(config.start as string || ""), timeZone: "UTC" },
            end: { dateTime: interpolate(config.end as string || ""), timeZone: "UTC" },
            ...(attendees.length > 0 ? { attendees } : {}),
          };
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            { method: "POST", headers: calHeaders, body: JSON.stringify(event) }
          );
          if (!res.ok) throw new Error(`Calendar create ${res.status}`);
          const d = await res.json();
          output = { id: d.id, summary: d.summary, htmlLink: d.htmlLink, start: d.start, end: d.end };
        } else if (action === "delete") {
          const eventId = config.event_id as string;
          if (!eventId) throw new Error("Event ID is required");
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: "DELETE", headers: calHeaders });
          output = { deleted: true, event_id: eventId };
        }
        break;
      }

      // ── Messaging additions ───────────────────────────────────────────────────

      case "action_whatsapp": {
        const accessToken = config.access_token as string;
        const phoneNumberId = config.phone_number_id as string;
        if (!accessToken || !phoneNumberId) throw new Error("Access token and phone number ID are required");
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const to = interpolate(config.to as string || "").replace(/\D/g, "");
        const message = interpolate(config.message as string || "");
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
        output = { sent: true, message_id: d.messages?.[0]?.id, to };
        break;
      }

      // ── Approval & Notification ───────────────────────────────────────────────

      case "action_approval": {
        const approverEmail = config.approver_email as string;
        if (!approverEmail) throw new Error("Approver email is required");
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
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const subject = interpolate((config.subject as string) || "Action required: workflow approval");
        const message = interpolate((config.message as string) || "");
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
        output = { token, approve_url: approveUrl, reject_url: rejectUrl, approver_email: approverEmail, status: "pending" };
        break;
      }

      case "action_notification": {
        const channel = (config.channel as string) || "slack";
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const message = interpolate((config.message as string) || "Workflow notification");
        if (channel === "slack") {
          const webhookUrl = config.webhook_url as string;
          if (!webhookUrl) throw new Error("Slack webhook URL is required");
          const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message }) });
          if (!res.ok) throw new Error(`Slack notification ${res.status}`);
          output = { sent: true, channel: "slack" };
        } else {
          const emailTo = config.email_to as string;
          const smtpHost = config.smtp_host as string;
          const smtpUser = config.smtp_user as string;
          const smtpPass = config.smtp_pass as string;
          if (!emailTo || !smtpHost || !smtpUser || !smtpPass) throw new Error("Email, SMTP host, user, and password are required");
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.createTransport({ host: smtpHost, port: 587, auth: { user: smtpUser, pass: smtpPass } });
          await transporter.sendMail({ from: smtpUser, to: emailTo, subject: "FlowMake Notification", text: message });
          output = { sent: true, channel: "email", to: emailTo };
        }
        break;
      }

      // ── AI Agent ─────────────────────────────────────────────────────────────

      case "action_agent": {
        const apiKey = config.api_key as string;
        if (!apiKey) throw new Error("Anthropic API key is required");

        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const model = (config.model as string) || "claude-opus-4-5";
        const goal = interpolate(config.goal as string || "");
        const systemPrompt = (config.system_prompt as string) || "You are a helpful assistant.";
        const maxTurns = Math.min(Number(config.max_turns) || 10, 20);
        const enabledTools = ((config.tools as string) || "http,code").split(",").map((t) => t.trim());

        if (!goal) throw new Error("Goal is required");

        // Build tool definitions the agent can use
        const agentTools: Record<string, unknown>[] = [];

        if (enabledTools.includes("http")) {
          agentTools.push({
            name: "http_request",
            description: "Make an HTTP request to any URL and return the response",
            input_schema: {
              type: "object",
              properties: {
                url: { type: "string", description: "The URL to request" },
                method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], default: "GET" },
                headers: { type: "object", description: "Optional headers as key-value pairs" },
                body: { type: "string", description: "Optional request body (for POST/PUT)" },
              },
              required: ["url"],
            },
          });
        }

        if (enabledTools.includes("code")) {
          agentTools.push({
            name: "run_javascript",
            description: "Execute a JavaScript snippet and return its result. Use `return` to output a value.",
            input_schema: {
              type: "object",
              properties: {
                code: { type: "string", description: "JavaScript code to run. Has access to `input` (all workflow data) and `variables`." },
              },
              required: ["code"],
            },
          });
        }

        if (enabledTools.includes("data_store")) {
          agentTools.push({
            name: "data_store_get",
            description: "Get a value from the workflow data store by key",
            input_schema: {
              type: "object",
              properties: { key: { type: "string" } },
              required: ["key"],
            },
          });
          agentTools.push({
            name: "data_store_set",
            description: "Set a value in the workflow data store",
            input_schema: {
              type: "object",
              properties: { key: { type: "string" }, value: { type: "string" } },
              required: ["key", "value"],
            },
          });
        }

        // Agentic loop
        const messages: { role: string; content: unknown }[] = [
          { role: "user", content: `Workflow context (previous node outputs):\n${JSON.stringify(allData, null, 2)}\n\nGoal: ${goal}` },
        ];

        let turns = 0;
        let finalText = "";
        const toolLogs: { tool: string; input: unknown; result: unknown }[] = [];

        while (turns < maxTurns) {
          turns++;
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              system: systemPrompt,
              tools: agentTools,
              messages,
            }),
          });

          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error((d as { error?: { message: string } }).error?.message || `Anthropic ${res.status}`);
          }

          const response = await res.json() as {
            stop_reason: string;
            content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
          };

          messages.push({ role: "assistant", content: response.content });

          // If stop_reason is "end_turn" or no tool_use, we're done
          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          const textBlocks = response.content.filter((b) => b.type === "text");
          finalText = textBlocks.map((b) => b.text).join("\n").trim();

          if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) break;

          // Execute all tool calls
          const toolResults: { type: string; tool_use_id: string; content: string }[] = [];

          for (const block of toolUseBlocks) {
            const toolName = block.name as string;
            const toolInput = block.input as Record<string, unknown>;
            let toolResult: unknown;

            try {
              if (toolName === "http_request") {
                const fetchOpts: RequestInit = { method: (toolInput.method as string) || "GET" };
                if (toolInput.headers) fetchOpts.headers = toolInput.headers as Record<string, string>;
                if (toolInput.body) fetchOpts.body = toolInput.body as string;
                const r = await fetch(toolInput.url as string, fetchOpts);
                const ct = r.headers.get("content-type") || "";
                toolResult = { status: r.status, body: ct.includes("json") ? await r.json() : await r.text() };
              } else if (toolName === "run_javascript") {
                // eslint-disable-next-line no-new-func
                const fn = new Function("input", "variables", `"use strict"; ${toolInput.code}`);
                toolResult = await fn(allData, ctx.variables);
              } else if (toolName === "data_store_get") {
                const supabase = createServerClient();
                const { data } = await supabase.from("workflow_data_store")
                  .select("value").eq("workflow_id", ctx.workflowId || "global").eq("key", toolInput.key as string).single();
                toolResult = { key: toolInput.key, value: data?.value ?? null };
              } else if (toolName === "data_store_set") {
                const supabase = createServerClient();
                await supabase.from("workflow_data_store")
                  .upsert({ workflow_id: ctx.workflowId || "global", key: toolInput.key as string, value: toolInput.value as string }, { onConflict: "workflow_id,key" });
                toolResult = { key: toolInput.key, saved: true };
              } else {
                toolResult = { error: `Unknown tool: ${toolName}` };
              }
            } catch (err) {
              toolResult = { error: err instanceof Error ? err.message : String(err) };
            }

            toolLogs.push({ tool: toolName, input: toolInput, result: toolResult });
            toolResults.push({ type: "tool_result", tool_use_id: block.id as string, content: JSON.stringify(toolResult) });
          }

          messages.push({ role: "user", content: toolResults });
        }

        output = {
          result: finalText,
          turns,
          tool_calls: toolLogs.length,
          tool_logs: toolLogs,
          messages_count: messages.length,
        };
        break;
      }

      // ── MCP Tool ─────────────────────────────────────────────────────────────

      case "action_mcp_tool": {
        const serverUrl = config.server_url as string;
        const toolName = config.tool_name as string;
        if (!serverUrl || !toolName) throw new Error("Server URL and tool name are required");

        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interpolate = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        // Parse arguments — support both JSON literal and {{path}} references
        let args: Record<string, unknown> = {};
        const rawArgs = interpolate(config.arguments as string || "{}");
        try { args = JSON.parse(rawArgs); } catch { /* leave as empty */ }

        const timeout = Math.min(Number(config.timeout) || 30, 120) * 1000;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.auth_header) headers["Authorization"] = config.auth_header as string;

        // Use MCP JSON-RPC protocol over HTTP POST
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          const rpcPayload = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: toolName, arguments: args },
          };

          const res = await fetch(serverUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(rpcPayload),
            signal: controller.signal,
          });

          if (!res.ok) throw new Error(`MCP server returned ${res.status}`);

          const rpcRes = await res.json() as {
            result?: { content?: { type: string; text?: string }[] };
            error?: { message: string };
          };

          if (rpcRes.error) throw new Error(rpcRes.error.message);

          const content = rpcRes.result?.content ?? [];
          const textContent = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
          let parsedContent: unknown = textContent;
          try { parsedContent = JSON.parse(textContent); } catch { /* keep as string */ }

          output = { tool: toolName, result: parsedContent, raw_content: content };
        } finally {
          clearTimeout(timer);
        }
        break;
      }

      case "action_postgres": {
        const { Client } = await import("pg");
        const pgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const pgInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pgAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const client = new Client({
          host: String(config.host || "localhost"),
          port: Number(config.port || 5432),
          database: String(config.database || ""),
          user: String(config.user || ""),
          password: String(config.password || ""),
          ssl: String(config.ssl) === "true" ? { rejectUnauthorized: false } : false,
        });
        await client.connect();
        try {
          const sql = pgInterp(String(config.sql || ""));
          let params: string[] = [];
          if (config.params) {
            try { params = JSON.parse(pgInterp(String(config.params))); } catch { /* ignore */ }
          }
          const result = await client.query(sql, params);
          output = { rows: result.rows, rowCount: result.rowCount, fields: result.fields.map((f) => f.name) };
        } finally {
          await client.end();
        }
        break;
      }

      case "action_mysql": {
        const mysql = await import("mysql2/promise");
        const myAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const myInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), myAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const connection = await mysql.createConnection({
          host: String(config.host || "localhost"),
          port: Number(config.port || 3306),
          database: String(config.database || ""),
          user: String(config.user || ""),
          password: String(config.password || ""),
          ssl: String(config.ssl) === "true" ? {} : undefined,
        });
        try {
          const sql = myInterp(String(config.sql || ""));
          let params: (string | number | boolean | null)[] = [];
          if (config.params) {
            try { params = JSON.parse(myInterp(String(config.params))); } catch { /* ignore */ }
          }
          const [rows] = await connection.execute(sql, params);
          output = { rows };
        } finally {
          await connection.end();
        }
        break;
      }

      case "action_mongodb": {
        const { MongoClient } = await import("mongodb");
        const mgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const mgInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), mgAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const uri = mgInterp(String(config.uri || "mongodb://localhost:27017"));
        const mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        try {
          const db = mongoClient.db(String(config.database || ""));
          const coll = db.collection(String(config.collection || ""));
          const action = String(config.action || "find");
          const filterStr = mgInterp(String(config.filter || "{}"));
          let query: Record<string, unknown> = {};
          try { query = JSON.parse(filterStr); } catch { /* ignore */ }

          if (action === "find") {
            const limit = Number(config.limit || 20);
            const docs = await coll.find(query).limit(limit).toArray();
            output = { documents: docs, count: docs.length };
          } else if (action === "findOne") {
            const doc = await coll.findOne(query);
            output = { document: doc };
          } else if (action === "insertOne") {
            const docStr = mgInterp(String(config.document || "{}"));
            let doc: Record<string, unknown> = {};
            try { doc = JSON.parse(docStr); } catch { /* ignore */ }
            const res = await coll.insertOne(doc);
            output = { insertedId: res.insertedId };
          } else if (action === "updateOne") {
            const updateStr = mgInterp(String(config.update || "{}"));
            let update: Record<string, unknown> = {};
            try { update = JSON.parse(updateStr); } catch { /* ignore */ }
            const res = await coll.updateOne(query, update);
            output = { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
          } else if (action === "deleteOne") {
            const res = await coll.deleteOne(query);
            output = { deletedCount: res.deletedCount };
          } else if (action === "aggregate") {
            const pipelineStr = mgInterp(String(config.pipeline || "[]"));
            let pipeline: Record<string, unknown>[] = [];
            try { pipeline = JSON.parse(pipelineStr); } catch { /* ignore */ }
            const docs = await coll.aggregate(pipeline).toArray();
            output = { documents: docs, count: docs.length };
          } else {
            throw new Error(`Unknown MongoDB action: ${action}`);
          }
        } finally {
          await mongoClient.close();
        }
        break;
      }

      case "action_redis": {
        const { default: Redis } = await import("ioredis");
        const rdAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const rdInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), rdAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const redis = new Redis({
          host: String(config.host || "localhost"),
          port: Number(config.port || 6379),
          password: config.password ? String(config.password) : undefined,
          db: Number(config.db || 0),
        });
        try {
          const action = String(config.action || "get");
          const key = rdInterp(String(config.key || ""));
          const value = config.value ? rdInterp(String(config.value)) : "";
          const ttl = Number(config.ttl || 0);

          if (action === "get") {
            const val = await redis.get(key);
            let parsed: unknown = val;
            if (val) { try { parsed = JSON.parse(val); } catch { /* keep as string */ } }
            output = { key, value: parsed };
          } else if (action === "set") {
            if (ttl > 0) {
              await redis.set(key, value, "EX", ttl);
            } else {
              await redis.set(key, value);
            }
            output = { key, set: true };
          } else if (action === "del") {
            const count = await redis.del(key);
            output = { key, deleted: count };
          } else if (action === "exists") {
            const exists = await redis.exists(key);
            output = { key, exists: exists > 0 };
          } else if (action === "incr") {
            const val = await redis.incr(key);
            output = { key, value: val };
          } else if (action === "lpush") {
            await redis.lpush(key, value);
            output = { key, pushed: true };
          } else if (action === "lrange") {
            const start = Number(config.start || 0);
            const stop = Number(config.stop || -1);
            const items = await redis.lrange(key, start, stop);
            output = { key, items };
          } else if (action === "hset") {
            const field = rdInterp(String(config.field || ""));
            await redis.hset(key, field, value);
            output = { key, field, set: true };
          } else if (action === "hget") {
            const field = rdInterp(String(config.field || ""));
            const val = await redis.hget(key, field);
            output = { key, field, value: val };
          } else if (action === "hgetall") {
            const hash = await redis.hgetall(key);
            output = { key, value: hash };
          } else {
            throw new Error(`Unknown Redis action: ${action}`);
          }
        } finally {
          redis.disconnect();
        }
        break;
      }

      case "action_supabase_db": {
        const sbAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const sbInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sbAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const supabaseUrl = sbInterp(String(config.url || "")).replace(/\/$/, "");
        const supabaseKey = sbInterp(String(config.anon_key || ""));
        const table = sbInterp(String(config.table || ""));
        const action = String(config.action || "select");

        const sbHeaders: Record<string, string> = {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        };

        if (action === "select") {
          const columns = String(config.columns || "*");
          const filterCol = config.filter_column ? sbInterp(String(config.filter_column)) : "";
          const filterVal = config.filter_value ? sbInterp(String(config.filter_value)) : "";
          const limit = Number(config.limit || 20);
          let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}&limit=${limit}`;
          if (filterCol && filterVal) url += `&${filterCol}=eq.${encodeURIComponent(filterVal)}`;
          const res = await fetch(url, { headers: sbHeaders });
          if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
          const rows = await res.json() as unknown[];
          output = { rows, count: rows.length };
        } else if (action === "insert") {
          const bodyStr = sbInterp(String(config.record || "{}"));
          let body: unknown = {};
          try { body = JSON.parse(bodyStr); } catch { /* ignore */ }
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: "POST", headers: sbHeaders,
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
          output = { inserted: await res.json() };
        } else if (action === "update") {
          const filterCol = sbInterp(String(config.filter_column || "id"));
          const filterVal = sbInterp(String(config.filter_value || ""));
          const bodyStr = sbInterp(String(config.record || "{}"));
          let body: unknown = {};
          try { body = JSON.parse(bodyStr); } catch { /* ignore */ }
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`, {
            method: "PATCH", headers: sbHeaders,
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
          output = { updated: await res.json() };
        } else if (action === "delete") {
          const filterCol = sbInterp(String(config.filter_column || "id"));
          const filterVal = sbInterp(String(config.filter_value || ""));
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`, {
            method: "DELETE", headers: sbHeaders,
          });
          if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
          output = { deleted: true };
        } else if (action === "rpc") {
          const fnName = sbInterp(String(config.function_name || ""));
          const argsStr = sbInterp(String(config.function_args || "{}"));
          let args: unknown = {};
          try { args = JSON.parse(argsStr); } catch { /* ignore */ }
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
            method: "POST", headers: sbHeaders,
            body: JSON.stringify(args),
          });
          if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
          output = { result: await res.json() };
        } else {
          throw new Error(`Unknown Supabase action: ${action}`);
        }
        break;
      }

      case "action_kafka": {
        const { Kafka, logLevel } = await import("kafkajs");
        const kfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const kfInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), kfAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const brokers = String(config.brokers || "").split(",").map((b) => b.trim()).filter(Boolean);
        const ssl = String(config.ssl) === "true";
        const saslMechanism = String(config.sasl_mechanism || "none");

        const kafkaConfig: Record<string, unknown> = {
          clientId: String(config.client_id || "workflow-node"),
          brokers,
          ssl,
          logLevel: logLevel.ERROR,
        };
        if (saslMechanism !== "none" && config.sasl_username) {
          kafkaConfig.sasl = {
            mechanism: saslMechanism,
            username: String(config.sasl_username),
            password: String(config.sasl_password || ""),
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kafka = new Kafka(kafkaConfig as any);
        const topic = kfInterp(String(config.topic || ""));
        const action = String(config.action || "produce");

        if (action === "produce") {
          const producer = kafka.producer();
          await producer.connect();
          try {
            const message: Record<string, unknown> = { value: kfInterp(String(config.message || "")) };
            if (config.key) message.key = kfInterp(String(config.key));
            if (config.partition !== undefined && config.partition !== "") message.partition = Number(config.partition);
            const result = await producer.send({ topic, messages: [message as { key?: string; value: string; partition?: number }] });
            output = { topic, sent: true, metadata: result };
          } finally {
            await producer.disconnect();
          }
        } else {
          // consume: fetch latest N messages using admin + offset seek
          const consumer = kafka.consumer({ groupId: String(config.group_id || "workflow-consumer") });
          await consumer.connect();
          try {
            await consumer.subscribe({ topic, fromBeginning: false });
            const messages: unknown[] = [];
            const maxMessages = Number(config.num_messages || 10);
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => resolve(), 8000);
              consumer.run({
                eachMessage: async ({ message: msg }) => {
                  messages.push({ key: msg.key?.toString(), value: msg.value?.toString(), offset: msg.offset, timestamp: msg.timestamp });
                  if (messages.length >= maxMessages) { clearTimeout(timer); resolve(); }
                },
              }).catch((err) => { clearTimeout(timer); reject(err); });
            });
            output = { topic, messages, count: messages.length };
          } finally {
            await consumer.disconnect();
          }
        }
        break;
      }

      case "action_mqtt": {
        const mqttLib = await import("mqtt");
        const mqAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const mqInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), mqAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const brokerUrl = mqInterp(String(config.broker_url || ""));
        const topic = mqInterp(String(config.topic || ""));
        const qos = Number(config.qos || 0) as 0 | 1 | 2;
        const action = String(config.action || "publish");
        const clientOpts: Record<string, unknown> = {};
        if (config.client_id) clientOpts.clientId = mqInterp(String(config.client_id));
        if (config.username) clientOpts.username = String(config.username);
        if (config.password) clientOpts.password = String(config.password);

        const client = mqttLib.connect(brokerUrl, clientOpts as Parameters<typeof mqttLib.connect>[1]);

        output = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { client.end(true); reject(new Error("MQTT timeout")); }, Number(config.timeout || 10000));

          client.on("error", (err) => { clearTimeout(timeout); client.end(true); reject(err); });
          client.on("connect", () => {
            if (action === "publish") {
              const payload = mqInterp(String(config.payload || ""));
              const retain = String(config.retain) === "true";
              client.publish(topic, payload, { qos, retain }, (err) => {
                clearTimeout(timeout);
                client.end();
                if (err) reject(err);
                else resolve({ topic, published: true, payload });
              });
            } else {
              client.subscribe(topic, { qos }, (err) => {
                if (err) { clearTimeout(timeout); client.end(true); reject(err); return; }
                client.on("message", (t, msg) => {
                  clearTimeout(timeout);
                  client.end();
                  let parsed: unknown = msg.toString();
                  try { parsed = JSON.parse(msg.toString()); } catch { /* keep as string */ }
                  resolve({ topic: t, payload: parsed, raw: msg.toString() });
                });
              });
            }
          });
        });
        break;
      }

      case "action_rabbitmq": {
        const amqp = await import("amqplib");
        const rmqAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const rmqInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), rmqAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const url = String(config.url || "amqp://localhost");
        const action = String(config.action || "publish");
        const conn = await amqp.connect(url);
        try {
          const ch = await conn.createChannel();
          const durable = String(config.durable) !== "false";
          const persistent = String(config.persistent) !== "false";

          if (action === "publish") {
            const exchange = rmqInterp(String(config.exchange || ""));
            const routingKey = rmqInterp(String(config.routing_key || ""));
            const body = rmqInterp(String(config.message || "{}"));
            const exchangeType = String(config.exchange_type || "direct");
            await ch.assertExchange(exchange, exchangeType, { durable });
            ch.publish(exchange, routingKey, Buffer.from(body), { persistent });
            output = { exchange, routingKey, published: true };
          } else if (action === "send_to_queue") {
            const queue = rmqInterp(String(config.queue || ""));
            const body = rmqInterp(String(config.message || "{}"));
            await ch.assertQueue(queue, { durable });
            ch.sendToQueue(queue, Buffer.from(body), { persistent });
            output = { queue, sent: true };
          } else if (action === "consume") {
            const queue = rmqInterp(String(config.queue || ""));
            await ch.assertQueue(queue, { durable });
            const msg = await ch.get(queue, { noAck: true });
            if (msg) {
              const body = msg.content.toString();
              let parsed: unknown = body;
              try { parsed = JSON.parse(body); } catch { /* keep as string */ }
              output = { queue, message: parsed, raw: body, fields: msg.fields };
            } else {
              output = { queue, message: null, empty: true };
            }
          } else if (action === "assert_queue") {
            const queue = rmqInterp(String(config.queue || ""));
            const info = await ch.assertQueue(queue, { durable });
            output = { queue: info.queue, messageCount: info.messageCount, consumerCount: info.consumerCount };
          }
          await ch.close();
        } finally {
          await conn.close();
        }
        break;
      }

      case "action_elasticsearch": {
        const { Client: EsClient } = await import("@elastic/elasticsearch");
        const esAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const esInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), esAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const esClientOpts: Record<string, unknown> = { node: esInterp(String(config.node || "http://localhost:9200")) };
        if (config.api_key) {
          esClientOpts.auth = { apiKey: String(config.api_key) };
        } else if (config.username) {
          esClientOpts.auth = { username: String(config.username), password: String(config.password || "") };
        }

        const esClient = new EsClient(esClientOpts as ConstructorParameters<typeof EsClient>[0]);
        const esIndex = esInterp(String(config.index || ""));
        const esAction = String(config.action || "search");

        try {
          if (esAction === "search") {
            const queryStr = esInterp(String(config.query || '{"match_all": {}}'));
            let query: Record<string, unknown> = {};
            try { query = JSON.parse(queryStr); } catch { /* ignore */ }
            const size = Number(config.size || 10);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await esClient.search({ index: esIndex, query: query as any, size });
            const hits = (result.hits?.hits ?? []).map((h) => ({ id: h._id, score: h._score, source: h._source }));
            output = { hits, total: result.hits?.total };
          } else if (esAction === "get") {
            const id = esInterp(String(config.doc_id || ""));
            const result = await esClient.get({ index: esIndex, id });
            output = { id: result._id, source: result._source, found: result.found };
          } else if (esAction === "index") {
            const docStr = esInterp(String(config.document || "{}"));
            let doc: Record<string, unknown> = {};
            try { doc = JSON.parse(docStr); } catch { /* ignore */ }
            const id = config.doc_id ? esInterp(String(config.doc_id)) : undefined;
            const result = await esClient.index({ index: esIndex, id, document: doc });
            output = { id: result._id, result: result.result };
          } else if (esAction === "update") {
            const id = esInterp(String(config.doc_id || ""));
            const docStr = esInterp(String(config.document || "{}"));
            let doc: Record<string, unknown> = {};
            try { doc = JSON.parse(docStr); } catch { /* ignore */ }
            const result = await esClient.update({ index: esIndex, id, doc });
            output = { id: result._id, result: result.result };
          } else if (esAction === "delete") {
            const id = esInterp(String(config.doc_id || ""));
            const result = await esClient.delete({ index: esIndex, id });
            output = { id: result._id, result: result.result };
          } else if (esAction === "count") {
            const queryStr = esInterp(String(config.query || '{"match_all": {}}'));
            let query: Record<string, unknown> = {};
            try { query = JSON.parse(queryStr); } catch { /* ignore */ }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await esClient.count({ index: esIndex, query: query as any });
            output = { count: result.count };
          }
        } finally {
          await esClient.close();
        }
        break;
      }

      case "action_nats": {
        const natsLib = await import("nats");
        const ntAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const ntInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ntAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });

        const servers = String(config.servers || "nats://localhost:4222").split(",").map((s) => s.trim());
        const connOpts: Record<string, unknown> = { servers };
        if (config.username) connOpts.user = String(config.username);
        if (config.password) connOpts.pass = String(config.password);
        if (config.token) connOpts.token = String(config.token);

        const nc = await natsLib.connect(connOpts as Parameters<typeof natsLib.connect>[0]);
        try {
          const sc = natsLib.StringCodec();
          const subject = ntInterp(String(config.subject || ""));
          const payload = ntInterp(String(config.payload || ""));
          const action = String(config.action || "publish");

          if (action === "publish") {
            nc.publish(subject, sc.encode(payload));
            await nc.flush();
            output = { subject, published: true, payload };
          } else {
            // request-reply
            const timeoutMs = Number(config.timeout || 5000);
            const msg = await nc.request(subject, sc.encode(payload), { timeout: timeoutMs });
            const replyStr = sc.decode(msg.data);
            let replyParsed: unknown = replyStr;
            try { replyParsed = JSON.parse(replyStr); } catch { /* keep as string */ }
            output = { subject, reply: replyParsed, raw: replyStr };
          }
        } finally {
          await nc.drain();
        }
        break;
      }

      // ── Utilities ────────────────────────────────────────────────────────────
      case "action_xml": {
        const xmlAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const xmlInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), xmlAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const xml2js = await import("xml2js");
        const action = String(config.action || "parse");
        const input = xmlInterp(String(config.input || ""));
        if (action === "parse") {
          const result = await xml2js.parseStringPromise(input, { explicitArray: false, mergeAttrs: true });
          output = result;
        } else {
          let obj: unknown = {};
          try { obj = JSON.parse(input); } catch { /* ignore */ }
          const rootElement = String(config.root_element || "root");
          const pretty = String(config.pretty) !== "false";
          const builder = new xml2js.Builder({ rootName: rootElement, renderOpts: { pretty, indent: "  " } });
          output = { xml: builder.buildObject(obj) };
        }
        break;
      }

      case "action_crypto": {
        const cryptoAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const cryptoInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), cryptoAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const nodeCrypto = await import("crypto");
        const action = String(config.action || "hash");
        const input = cryptoInterp(String(config.input || ""));
        const key = String(config.key || "");
        const algo = String(config.algorithm || "sha256");
        const enc = (String(config.encoding || "hex")) as "hex" | "base64";

        if (action === "hash") {
          const hash = nodeCrypto.createHash(algo).update(input).digest(enc);
          output = { hash, algorithm: algo };
        } else if (action === "hmac") {
          const hmac = nodeCrypto.createHmac(algo, key).update(input).digest(enc);
          output = { hmac, algorithm: algo };
        } else if (action === "encrypt") {
          const iv = nodeCrypto.randomBytes(16);
          const keyBuf = nodeCrypto.createHash("sha256").update(key).digest();
          const cipher = nodeCrypto.createCipheriv("aes-256-cbc", keyBuf, iv);
          const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
          output = { encrypted: encrypted.toString("base64"), iv: iv.toString("base64") };
        } else if (action === "decrypt") {
          const iv = Buffer.from(String(config.iv || ""), "base64");
          const keyBuf = nodeCrypto.createHash("sha256").update(key).digest();
          const decipher = nodeCrypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
          const decrypted = Buffer.concat([decipher.update(Buffer.from(input, "base64")), decipher.final()]);
          output = { decrypted: decrypted.toString("utf8") };
        } else if (action === "base64_encode") {
          output = { encoded: Buffer.from(input).toString("base64") };
        } else if (action === "base64_decode") {
          output = { decoded: Buffer.from(input, "base64").toString("utf8") };
        } else if (action === "uuid") {
          output = { uuid: nodeCrypto.randomUUID() };
        }
        break;
      }

      case "action_jwt": {
        const jwtAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const jwtInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), jwtAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const jwt = await import("jsonwebtoken");
        const action = String(config.action || "sign");
        const secret = String(config.secret || "");

        if (action === "sign") {
          const payloadStr = jwtInterp(String(config.payload || "{}"));
          let payload: Record<string, unknown> = {};
          try { payload = JSON.parse(payloadStr); } catch { /* ignore */ }
          const opts: Record<string, unknown> = { algorithm: String(config.algorithm || "HS256") };
          if (config.expires_in) opts.expiresIn = String(config.expires_in);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const token = jwt.sign(payload, secret, opts as any);
          output = { token };
        } else if (action === "verify") {
          const token = jwtInterp(String(config.token || ""));
          try {
            const decoded = jwt.verify(token, secret);
            output = { valid: true, payload: decoded };
          } catch (err) {
            output = { valid: false, error: (err as Error).message };
          }
        } else {
          const token = jwtInterp(String(config.token || ""));
          const decoded = jwt.decode(token, { complete: true });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          output = { decoded, payload: (decoded as any)?.payload };
        }
        break;
      }

      case "action_pdf": {
        const pdfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const pdfInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pdfAllData);
            if (val !== undefined) return String(val);
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const PDFDocument = (await import("pdfkit")).default;
        const title = pdfInterp(String(config.title || "Document"));
        const content = pdfInterp(String(config.content || ""));
        const fontSize = Number(config.font_size || 12);

        // Resolve image: config.image_base64 can be a {{node.base64}} reference
        let imageBuf: Buffer | null = null;
        if (config.image_base64) {
          const imgStr = pdfInterp(String(config.image_base64)).replace(/^data:[^;]+;base64,/, "");
          if (imgStr.length > 0) imageBuf = Buffer.from(imgStr, "base64");
        }

        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument({ margin: 50, size: "A4" });
          const chunks: Buffer[] = [];
          doc.on("data", (c: Buffer) => chunks.push(c));
          doc.on("end", () => resolve(Buffer.concat(chunks)));
          doc.on("error", reject);

          // Title
          if (title) {
            doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" }).moveDown(1);
          }

          // Embed image centered (QR code or any image)
          if (imageBuf) {
            const pageWidth = 595 - 100; // A4 minus margins
            const imgSize = Math.min(Number(config.image_width || 250), pageWidth);
            const xCenter = (595 - imgSize) / 2;
            const imgY = doc.y;
            doc.image(imageBuf, xCenter, imgY, { width: imgSize });
            // Manually advance cursor past the image — pdfkit doesn't do this
            // reliably with explicit x/y coords. Assume square aspect ratio for
            // QR codes; add 20pt padding below.
            doc.y = imgY + imgSize + 20;
          }

          // Body text
          if (content) {
            doc.fontSize(fontSize).font("Helvetica").text(content, { lineGap: 6, align: "left" });
          }

          // Footer with date
          const now = new Date();
          const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          doc.fontSize(9).font("Helvetica").fillColor("#9ca3af")
            .text(`Generated by FlowMake · ${dateStr} ${timeStr}`, 50, 780, { align: "center", width: 495 });

          doc.end();
        });

        // Upload to Supabase Storage and return a public URL
        const fileName = `${Date.now()}-${(title || "document").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ywxhthzgneqzbzjvbzou.supabase.co";
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

        let pdfUrl: string | null = null;
        try {
          const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/pdfs/${fileName}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/pdf",
              "x-upsert": "true",
            },
            body: pdfBuffer as unknown as BodyInit,
          });
          if (uploadRes.ok) {
            pdfUrl = `${supabaseUrl}/storage/v1/object/public/pdfs/${fileName}`;
          }
        } catch { /* upload failed, return base64 only */ }

        output = {
          pdf_url: pdfUrl,
          pdf_base64: pdfBuffer.toString("base64"),
          size_bytes: pdfBuffer.length,
          filename: fileName,
        };
        break;
      }

      case "action_image": {
        const imgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const imgInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), imgAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const sharp = (await import("sharp")).default;
        const inputStr = imgInterp(String(config.input_base64 || ""));
        let inputBuf: Buffer;
        if (inputStr.startsWith("http://") || inputStr.startsWith("https://")) {
          const res = await fetch(inputStr);
          inputBuf = Buffer.from(await res.arrayBuffer());
        } else {
          inputBuf = Buffer.from(inputStr.replace(/^data:[^;]+;base64,/, ""), "base64");
        }

        const action = String(config.action || "resize");
        const format = String(config.format || "jpeg") as "jpeg" | "png" | "webp" | "avif";
        const quality = Number(config.quality || 80);
        let img = sharp(inputBuf);

        if (action === "metadata") {
          const meta = await img.metadata();
          output = meta;
          break;
        } else if (action === "resize") {
          const width = config.width ? Number(config.width) : undefined;
          const height = config.height ? Number(config.height) : undefined;
          const fit = String(config.fit || "cover") as "cover" | "contain" | "fill" | "inside" | "outside";
          img = img.resize({ width, height, fit });
        } else if (action === "grayscale") {
          img = img.grayscale();
        } else if (action === "rotate") {
          img = img.rotate(Number(config.angle || 90));
        }
        // convert / compress just apply format+quality below
        const outBuf = await img[format]({ quality }).toBuffer();
        output = { base64: outBuf.toString("base64"), format, size_bytes: outBuf.length };
        break;
      }

      case "action_qrcode": {
        const qrAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const qrInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), qrAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const QRCode = await import("qrcode");
        const text = qrInterp(String(config.text || ""));
        const fmt = String(config.format || "png");
        const opts = {
          errorCorrectionLevel: (String(config.error_correction || "M")) as "L" | "M" | "Q" | "H",
          width: Number(config.width || 300),
          margin: Number(config.margin || 4),
          color: { dark: String(config.dark_color || "#000000"), light: String(config.light_color || "#ffffff") },
        };
        if (fmt === "svg") {
          const svg = await QRCode.toString(text, { ...opts, type: "svg" });
          output = { svg, text };
        } else if (fmt === "terminal") {
          const ascii = await QRCode.toString(text, { type: "terminal" });
          output = { ascii, text };
        } else {
          const dataUrl = await QRCode.toDataURL(text, opts);
          const base64 = dataUrl.replace("data:image/png;base64,", "");
          output = { base64, data_url: dataUrl, text };
        }
        break;
      }

      // ── More AI ──────────────────────────────────────────────────────────────
      case "action_gemini": {
        const gmAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const gmInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), gmAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(String(config.api_key || ""));
        const model = genAI.getGenerativeModel({ model: String(config.model || "gemini-1.5-flash") });
        const prompt = gmInterp(String(config.prompt || ""));
        const systemPrompt = config.system_prompt ? gmInterp(String(config.system_prompt)) : "";
        const action = String(config.action || "generate");

        if (action === "vision" && config.image_base64) {
          const imageData = gmInterp(String(config.image_base64)).replace(/^data:[^;]+;base64,/, "");
          const result = await model.generateContent([
            { inlineData: { data: imageData, mimeType: "image/jpeg" } },
            prompt,
          ]);
          output = { text: result.response.text(), model: String(config.model) };
        } else {
          const parts = systemPrompt ? [systemPrompt + "\n\n" + prompt] : [prompt];
          const result = await model.generateContent(parts);
          output = { text: result.response.text(), model: String(config.model) };
        }
        break;
      }

      case "action_groq": {
        const grAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const grInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), grAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const Groq = (await import("groq-sdk")).default;
        const groq = new Groq({ apiKey: String(config.api_key || "") });
        const messages: { role: "system" | "user"; content: string }[] = [];
        if (config.system_prompt) messages.push({ role: "system", content: grInterp(String(config.system_prompt)) });
        messages.push({ role: "user", content: grInterp(String(config.prompt || "")) });
        const reqOpts: Record<string, unknown> = {
          model: String(config.model || "llama-3.1-8b-instant"),
          messages,
          max_tokens: Number(config.max_tokens || 1024),
          temperature: Number(config.temperature || 0.7),
        };
        if (String(config.json_mode) === "true") reqOpts.response_format = { type: "json_object" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completion = await groq.chat.completions.create(reqOpts as any);
        const text = completion.choices[0]?.message?.content ?? "";
        let parsed: unknown = text;
        if (String(config.json_mode) === "true") { try { parsed = JSON.parse(text); } catch { /* keep */ } }
        output = { text, parsed, model: completion.model, usage: completion.usage };
        break;
      }

      case "action_mistral": {
        const msAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const msInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), msAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const { Mistral } = await import("@mistralai/mistralai");
        const mistral = new Mistral({ apiKey: String(config.api_key || "") });
        const msgs: { role: "system" | "user"; content: string }[] = [];
        if (config.system_prompt) msgs.push({ role: "system", content: msInterp(String(config.system_prompt)) });
        msgs.push({ role: "user", content: msInterp(String(config.prompt || "")) });
        const mOpts: Record<string, unknown> = {
          model: String(config.model || "mistral-small-latest"),
          messages: msgs,
          maxTokens: Number(config.max_tokens || 1024),
          temperature: Number(config.temperature || 0.7),
        };
        if (String(config.json_mode) === "true") mOpts.responseFormat = { type: "json_object" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await mistral.chat.complete(mOpts as any);
        const text = (res.choices?.[0]?.message?.content as string) ?? "";
        let parsed: unknown = text;
        if (String(config.json_mode) === "true") { try { parsed = JSON.parse(text); } catch { /* keep */ } }
        output = { text, parsed, model: res.model, usage: res.usage };
        break;
      }

      case "action_whisper": {
        const wsAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const wsInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), wsAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const apiKey = String(config.api_key || "");
        const action = String(config.action || "transcribe");
        const responseFormat = String(config.response_format || "json");
        const language = config.language ? wsInterp(String(config.language)) : undefined;

        // Build multipart form data
        let audioBuffer: Buffer;
        let audioFilename = "audio.mp3";
        if (config.audio_url) {
          const url = wsInterp(String(config.audio_url));
          const r = await fetch(url);
          audioBuffer = Buffer.from(await r.arrayBuffer());
          audioFilename = url.split("/").pop() || "audio.mp3";
        } else {
          const b64 = wsInterp(String(config.audio_base64 || "")).replace(/^data:[^;]+;base64,/, "");
          audioBuffer = Buffer.from(b64, "base64");
        }

        const formData = new FormData();
        formData.append("file", new Blob([audioBuffer.buffer as ArrayBuffer]), audioFilename);
        formData.append("model", "whisper-1");
        formData.append("response_format", responseFormat);
        if (language) formData.append("language", language);

        const endpoint = action === "translate"
          ? "https://api.openai.com/v1/audio/translations"
          : "https://api.openai.com/v1/audio/transcriptions";

        const r = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });
        if (!r.ok) throw new Error(`Whisper error: ${await r.text()}`);
        const result = responseFormat === "json" || responseFormat === "verbose_json" ? await r.json() : { text: await r.text() };
        output = result;
        break;
      }

      case "action_pinecone": {
        const pcAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const pcInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pcAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const { Pinecone } = await import("@pinecone-database/pinecone");
        const pc = new Pinecone({ apiKey: String(config.api_key || "") });
        const idx = pc.index(String(config.index_name || ""));
        const ns = config.namespace ? idx.namespace(String(config.namespace)) : idx;
        const action = String(config.action || "query");

        if (action === "query") {
          const vecStr = pcInterp(String(config.vector || "[]"));
          let vector: number[] = [];
          try { vector = JSON.parse(vecStr); } catch { /* ignore */ }
          const filterStr = config.filter ? pcInterp(String(config.filter)) : "{}";
          let filter: Record<string, unknown> | undefined;
          try { const f = JSON.parse(filterStr); filter = Object.keys(f).length ? f : undefined; } catch { /* ignore */ }
          const results = await ns.query({ vector, topK: Number(config.top_k || 5), includeMetadata: true, includeValues: false, filter });
          output = { matches: results.matches, namespace: results.namespace };
        } else if (action === "upsert") {
          const id = pcInterp(String(config.id || ""));
          const vecStr = pcInterp(String(config.vector || "[]"));
          let values: number[] = [];
          try { values = JSON.parse(vecStr); } catch { /* ignore */ }
          const metaStr = config.metadata ? pcInterp(String(config.metadata)) : "{}";
          let metadata: Record<string, unknown> = {};
          try { metadata = JSON.parse(metaStr); } catch { /* ignore */ }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await ns.upsert({ records: [{ id, values, metadata: metadata as any }] });
          output = { upserted: true, id };
        } else if (action === "fetch") {
          const id = pcInterp(String(config.id || ""));
          const result = await ns.fetch({ ids: [id] });
          output = { record: result.records?.[id] };
        } else if (action === "delete") {
          const id = pcInterp(String(config.id || ""));
          await ns.deleteOne({ id });
          output = { deleted: true, id };
        } else if (action === "stats") {
          const stats = await idx.describeIndexStats();
          output = stats;
        }
        break;
      }

      case "action_weaviate": {
        const wvAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const wvInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), wvAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        // Use REST API directly since weaviate-client v3 has complex peer deps
        const host = wvInterp(String(config.host || "http://localhost:8080")).replace(/\/$/, "");
        const apiKey = config.api_key ? String(config.api_key) : "";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        const collection = String(config.collection || "");
        const action = String(config.action || "search");
        const limit = Number(config.limit || 5);
        const props = config.properties ? String(config.properties).split(",").map((s) => s.trim()) : [];

        if (action === "search") {
          const queryText = wvInterp(String(config.query_text || ""));
          const graphql = { query: `{Get{${collection}(nearText:{concepts:["${queryText}"]}limit:${limit}){${props.join(" ") || "_additional{id distance}"}}} }` };
          const r = await fetch(`${host}/v1/graphql`, { method: "POST", headers, body: JSON.stringify(graphql) });
          if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
          output = await r.json();
        } else if (action === "vector_search") {
          const vecStr = wvInterp(String(config.vector || "[]"));
          let vector: number[] = [];
          try { vector = JSON.parse(vecStr); } catch { /* ignore */ }
          const graphql = { query: `{Get{${collection}(nearVector:{vector:${JSON.stringify(vector)}}limit:${limit}){${props.join(" ") || "_additional{id distance}"}}} }` };
          const r = await fetch(`${host}/v1/graphql`, { method: "POST", headers, body: JSON.stringify(graphql) });
          if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
          output = await r.json();
        } else if (action === "get") {
          const id = wvInterp(String(config.id || ""));
          const r = await fetch(`${host}/v1/objects/${collection}/${id}`, { headers });
          if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
          output = await r.json();
        } else if (action === "create") {
          const objStr = wvInterp(String(config.object || "{}"));
          let obj: Record<string, unknown> = {};
          try { obj = JSON.parse(objStr); } catch { /* ignore */ }
          const body = { class: collection, properties: obj };
          const r = await fetch(`${host}/v1/objects`, { method: "POST", headers, body: JSON.stringify(body) });
          if (!r.ok) throw new Error(`Weaviate error: ${await r.text()}`);
          output = await r.json();
        } else if (action === "delete") {
          const id = wvInterp(String(config.id || ""));
          const r = await fetch(`${host}/v1/objects/${collection}/${id}`, { method: "DELETE", headers });
          output = { deleted: r.ok, id };
        }
        break;
      }

      // ── Infrastructure ───────────────────────────────────────────────────────
      case "action_ssh": {
        const sshAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const sshInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sshAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const { Client: SshClient } = await import("ssh2");
        const host = sshInterp(String(config.host || ""));
        const command = sshInterp(String(config.command || ""));
        const connOpts: Record<string, unknown> = {
          host,
          port: Number(config.port || 22),
          username: String(config.username || "root"),
          readyTimeout: Number(config.timeout || 30000),
        };
        if (config.private_key) {
          connOpts.privateKey = String(config.private_key);
        } else {
          connOpts.password = String(config.password || "");
        }

        output = await new Promise((resolve, reject) => {
          const conn = new SshClient();
          conn.on("ready", () => {
            conn.exec(command, (err, stream) => {
              if (err) { conn.end(); return reject(err); }
              let stdout = "";
              let stderr = "";
              stream.on("close", (code: number) => {
                conn.end();
                resolve({ stdout, stderr, exit_code: code, command });
              });
              stream.on("data", (d: Buffer) => { stdout += d.toString(); });
              stream.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
            });
          });
          conn.on("error", (err) => reject(err));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          conn.connect(connOpts as any);
        });
        break;
      }

      case "action_ftp": {
        const ftpAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const ftpInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ftpAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const ftp = await import("basic-ftp");
        const client = new ftp.Client();
        try {
          await client.access({
            host: ftpInterp(String(config.host || "")),
            port: Number(config.port || 21),
            user: String(config.username || "anonymous"),
            password: String(config.password || ""),
            secure: String(config.secure) === "true",
          });
          const action = String(config.action || "list");
          const remotePath = ftpInterp(String(config.remote_path || "/"));

          if (action === "list") {
            const list = await client.list(remotePath);
            output = { files: list.map((f) => ({ name: f.name, size: f.size, type: f.type, date: f.date })) };
          } else if (action === "upload") {
            const content = ftpInterp(String(config.local_content || ""));
            const filename = String(config.local_filename || "upload.txt");
            const buf = Buffer.from(content.replace(/^data:[^;]+;base64,/, ""), content.startsWith("data:") ? "base64" : "utf8");
            const { Readable } = await import("stream");
            await client.uploadFrom(Readable.from(buf), remotePath.endsWith("/") ? remotePath + filename : remotePath);
            output = { uploaded: true, path: remotePath };
          } else if (action === "download") {
            const { PassThrough } = await import("stream");
            const pt = new PassThrough();
            const chunks: Buffer[] = [];
            pt.on("data", (c: Buffer) => chunks.push(c));
            await client.downloadTo(pt, remotePath);
            const buf = Buffer.concat(chunks);
            output = { content: buf.toString("utf8"), base64: buf.toString("base64"), size_bytes: buf.length };
          } else if (action === "delete") {
            await client.remove(remotePath);
            output = { deleted: true, path: remotePath };
          } else if (action === "rename") {
            await client.rename(remotePath, ftpInterp(String(config.dest_path || "")));
            output = { renamed: true };
          } else if (action === "mkdir") {
            await client.ensureDir(remotePath);
            output = { created: true, path: remotePath };
          }
        } finally {
          client.close();
        }
        break;
      }

      case "action_sftp": {
        const sfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const sfInterp = (str: string) =>
          str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), sfAllData);
            if (val !== undefined) return String(val);
            // {{secret.NAME}} resolution
            if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
            return "";
          });
        const SftpClient = (await import("ssh2-sftp-client")).default;
        const sftp = new SftpClient();
        try {
          const connOpts: Record<string, unknown> = {
            host: sfInterp(String(config.host || "")),
            port: Number(config.port || 22),
            username: String(config.username || "root"),
          };
          if (config.private_key) connOpts.privateKey = String(config.private_key);
          else connOpts.password = String(config.password || "");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await sftp.connect(connOpts as any);
          const action = String(config.action || "list");
          const remotePath = sfInterp(String(config.remote_path || "/"));

          if (action === "list") {
            const list = await sftp.list(remotePath);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            output = { files: list.map((f: any) => ({ name: f.name, size: f.size, type: f.type, modifyTime: f.modifyTime })) };
          } else if (action === "upload") {
            const content = sfInterp(String(config.file_content || ""));
            const isBase64 = content.startsWith("data:") || !content.includes("\n") && content.length % 4 === 0;
            const buf = isBase64 ? Buffer.from(content.replace(/^data:[^;]+;base64,/, ""), "base64") : Buffer.from(content, "utf8");
            const filename = sfInterp(String(config.filename || "upload.txt"));
            const destPath = remotePath.endsWith("/") ? remotePath + filename : remotePath;
            const { Readable } = await import("stream");
            await sftp.put(Readable.from(buf), destPath);
            output = { uploaded: true, path: destPath };
          } else if (action === "download") {
            const buf = await sftp.get(remotePath) as Buffer;
            output = { content: buf.toString("utf8"), base64: buf.toString("base64"), size_bytes: buf.length };
          } else if (action === "delete") {
            await sftp.delete(remotePath);
            output = { deleted: true, path: remotePath };
          } else if (action === "mkdir") {
            await sftp.mkdir(remotePath, true);
            output = { created: true, path: remotePath };
          } else if (action === "rename") {
            await sftp.rename(remotePath, sfInterp(String(config.dest_path || "")));
            output = { renamed: true };
          }
        } finally {
          await sftp.end();
        }
        break;
      }

      case "action_user_table": {
        const supabase = createServerClient();
        const tableId = config.table_id as string;
        const action = (config.action as string) || "insert";
        if (!tableId) throw new Error("Table ID is required");

        // Interpolation helper
        const allData = { ...ctx.triggerData, ...ctx.nodeOutputs };
        const interp = (s: string) =>
          s.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
            const val = path.trim().split(".").reduce<unknown>((o, k) => {
              if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
              return undefined;
            }, allData);
            return val !== undefined ? String(val) : "";
          });

        // Parse optional data/filter JSON with interpolation
        const parseJson = (raw: unknown): Record<string, unknown> => {
          if (!raw) return {};
          const interpolated = interp(String(raw));
          try { return JSON.parse(interpolated); }
          catch { throw new Error(`Invalid JSON: ${interpolated}`); }
        };

        if (action === "insert") {
          const rowData = parseJson(config.data);
          const { data: inserted, error } = await supabase
            .from("user_table_rows")
            .insert({ table_id: tableId, data: rowData })
            .select()
            .single();
          if (error) throw new Error(error.message);
          output = { inserted: true, id: inserted.id, data: inserted.data };
        } else if (action === "query") {
          const filter = parseJson(config.filter);
          const limit = Math.min(Number(config.limit || 100), 1000);
          let q = supabase.from("user_table_rows").select("id, data, created_at").eq("table_id", tableId);
          for (const [k, v] of Object.entries(filter)) {
            q = q.filter(`data->>${k}`, "eq", String(v));
          }
          const { data: rows, error } = await q.limit(limit).order("created_at", { ascending: false });
          if (error) throw new Error(error.message);
          output = { rows: (rows ?? []).map(r => ({ id: r.id, ...r.data as object, _created_at: r.created_at })), count: rows?.length ?? 0 };
        } else if (action === "update") {
          const filter = parseJson(config.filter);
          const rowData = parseJson(config.data);
          let q = supabase.from("user_table_rows").update({ data: rowData }).eq("table_id", tableId);
          for (const [k, v] of Object.entries(filter)) {
            q = q.filter(`data->>${k}`, "eq", String(v));
          }
          const { data: updated, error } = await q.select();
          if (error) throw new Error(error.message);
          output = { updated: true, affected_rows: updated?.length ?? 0 };
        } else if (action === "delete") {
          const filter = parseJson(config.filter);
          let q = supabase.from("user_table_rows").delete().eq("table_id", tableId);
          for (const [k, v] of Object.entries(filter)) {
            q = q.filter(`data->>${k}`, "eq", String(v));
          }
          const { error } = await q;
          if (error) throw new Error(error.message);
          output = { deleted: true };
        } else if (action === "count") {
          const filter = parseJson(config.filter);
          let q = supabase.from("user_table_rows").select("id", { count: "exact", head: true }).eq("table_id", tableId);
          for (const [k, v] of Object.entries(filter)) {
            q = q.filter(`data->>${k}`, "eq", String(v));
          }
          const { count, error } = await q;
          if (error) throw new Error(error.message);
          output = { count: count ?? 0 };
        }
        break;
      }

      default:
        throw new Error(`Unknown node type: ${type}`);
    }

    log.status = "success";
    log.output = output;
    log.duration_ms = Date.now() - start;
    ctx.nodeOutputs[node.id] = output;
    return output;
}

async function executeNode(
  node: WorkflowNode,
  ctx: ExecutionContext,
  connections: Record<string, Record<string, unknown>> = {}
): Promise<unknown> {
  const start = Date.now();
  const log: ExecutionLog = {
    node_id: node.id,
    node_label: node.data.label,
    status: "running",
    input: node.data.config,
  };
  ctx.logs.push(log);

  const maxRetries = Math.max(0, Number(node.data.config.retry_count || 0));
  const retryDelayMs = Math.max(100, Number(node.data.config.retry_delay_ms || 1000));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(retryDelayMs * Math.pow(2, attempt - 1), 30000);
      await new Promise((r) => setTimeout(r, delay));
      log.status = "running";
    }
    try {
      const result = await executeNodeOnce(node, ctx, connections, log, start);
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) continue;
    }
  }

  const error = lastErr instanceof Error ? lastErr.message : String(lastErr);
  log.status = "error";
  log.error = error;
  log.duration_ms = Date.now() - start;
  throw lastErr;
}

function buildExecutionOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  // Topological sort
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const n of nodes) {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  }
  // Skip edges that reference nodes which no longer exist
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  for (const e of validEdges) {
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  }

  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const order: WorkflowNode[] = [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighborId of adj[node.id]) {
      inDegree[neighborId]--;
      if (inDegree[neighborId] === 0) {
        queue.push(nodeMap[neighborId]);
      }
    }
  }

  return order;
}

export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  triggerData: Record<string, unknown> = {},
  connections: Record<string, Record<string, unknown>> = {},
  workflowId?: string
): Promise<ExecutionContext> {
  // Load secrets from Supabase for {{secret.NAME}} interpolation
  let secrets: Record<string, string> = {};
  try {
    const supabase = createServerClient();
    const { data } = await supabase.from("workflow_secrets").select("name, value");
    if (data) secrets = Object.fromEntries(data.map((r: { name: string; value: string }) => [r.name, r.value]));
  } catch { /* secrets table may not exist yet */ }

  const ctx: ExecutionContext = {
    triggerData,
    nodeOutputs: {},
    logs: [],
    workflowId,
    variables: {},
    secrets,
  };

  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  const order = buildExecutionOrder(nodes, edges);

  // Track which branch handle each branching node chose (nodeId → handle id like "true"/"false"/"case_1")
  const branchOutputs: Record<string, string> = {};
  // Track nodes that were skipped due to inactive branch
  const skippedNodes = new Set<string>();

  for (const node of order) {
    // Determine if this node should be skipped
    const incomingEdges = validEdges.filter((e) => e.target === node.id);

    if (incomingEdges.length > 0) {
      const blockedCount = incomingEdges.filter((e) => {
        // Blocked if the source node was itself skipped
        if (skippedNodes.has(e.source)) return true;
        // Blocked if the source is a branching node and this edge's handle doesn't match the chosen branch
        const sourceBranch = branchOutputs[e.source];
        if (sourceBranch !== undefined && e.sourceHandle && e.sourceHandle !== sourceBranch) return true;
        return false;
      }).length;

      if (blockedCount === incomingEdges.length) {
        skippedNodes.add(node.id);
        ctx.logs.push({ node_id: node.id, node_label: node.data.label, status: "skipped" });
        continue;
      }
    }

    try {
      const result = await executeNode(node, ctx, connections);
      // If the node returned a branch decision, record it
      if (result && typeof result === "object" && "_branch" in (result as object)) {
        branchOutputs[node.id] = (result as Record<string, unknown>)._branch as string;
      }
    } catch {
      // Continue but don't record branch (failed nodes don't route)
    }
  }

  return ctx;
}
