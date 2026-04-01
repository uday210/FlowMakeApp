import type { NodeHandler } from "./types";
import { createServerClient } from "../supabase";

export const handlers: Record<string, NodeHandler> = {
  "action_rss": async ({ config }) => {
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
    return { count: items.length, items };
  },

  "action_datetime": async ({ config }) => {
    const action = (config.action as string) || "now";
    const format = (config.format as string) || "ISO";
    const timezone = (config.timezone as string) || "UTC";
    const inputDate = config.input ? new Date(config.input as string) : new Date();
    const date = action === "add"
      ? new Date(inputDate.getTime() + (Number(config.offset_days) || 0) * 86400000)
      : action === "format" ? inputDate : new Date();

    const formatDate = (d: Date) => {
      if (format === "unix") return Math.floor(d.getTime() / 1000);
      if (format === "date") return d.toLocaleDateString("en-CA", { timeZone: timezone });
      if (format === "time") return d.toLocaleTimeString("en-GB", { timeZone: timezone });
      if (format === "human") return d.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" } as Intl.DateTimeFormatOptions);
      return d.toISOString();
    };
    return { result: formatDate(date), timezone, format };
  },

  "action_math": async ({ config }) => {
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
    return { result, a, b, operation };
  },

  "action_xml": async ({ config, ctx }) => {
    const xmlAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const xmlInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), xmlAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const xml2js = await import("xml2js");
    const action = String(config.action || "parse");
    const input = xmlInterp(String(config.input || ""));
    if (action === "parse") {
      const result = await xml2js.parseStringPromise(input, { explicitArray: false, mergeAttrs: true });
      return result;
    } else {
      let obj: unknown = {};
      try { obj = JSON.parse(input); } catch { /* ignore */ }
      const rootElement = String(config.root_element || "root");
      const pretty = String(config.pretty) !== "false";
      const builder = new xml2js.Builder({ rootName: rootElement, renderOpts: { pretty, indent: "  " } });
      return { xml: builder.buildObject(obj) };
    }
  },

  "action_crypto": async ({ config, ctx }) => {
    const cryptoAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const cryptoInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), cryptoAllData);
        if (val !== undefined) return String(val);
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
      return { hash, algorithm: algo };
    } else if (action === "hmac") {
      const hmac = nodeCrypto.createHmac(algo, key).update(input).digest(enc);
      return { hmac, algorithm: algo };
    } else if (action === "encrypt") {
      const iv = nodeCrypto.randomBytes(16);
      const keyBuf = nodeCrypto.createHash("sha256").update(key).digest();
      const cipher = nodeCrypto.createCipheriv("aes-256-cbc", keyBuf, iv);
      const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
      return { encrypted: encrypted.toString("base64"), iv: iv.toString("base64") };
    } else if (action === "decrypt") {
      const iv = Buffer.from(String(config.iv || ""), "base64");
      const keyBuf = nodeCrypto.createHash("sha256").update(key).digest();
      const decipher = nodeCrypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
      const decrypted = Buffer.concat([decipher.update(Buffer.from(input, "base64")), decipher.final()]);
      return { decrypted: decrypted.toString("utf8") };
    } else if (action === "base64_encode") {
      return { encoded: Buffer.from(input).toString("base64") };
    } else if (action === "base64_decode") {
      return { decoded: Buffer.from(input, "base64").toString("utf8") };
    } else if (action === "uuid") {
      return { uuid: nodeCrypto.randomUUID() };
    }
    return undefined;
  },

  "action_jwt": async ({ config, ctx }) => {
    const jwtAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const jwtInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), jwtAllData);
        if (val !== undefined) return String(val);
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
      return { token };
    } else if (action === "verify") {
      const token = jwtInterp(String(config.token || ""));
      try {
        const decoded = jwt.verify(token, secret);
        return { valid: true, payload: decoded };
      } catch (err) {
        return { valid: false, error: (err as Error).message };
      }
    } else {
      const token = jwtInterp(String(config.token || ""));
      const decoded = jwt.decode(token, { complete: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { decoded, payload: (decoded as any)?.payload };
    }
  },

  "action_pdf": async ({ config, ctx }) => {
    const pdfAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const pdfInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pdfAllData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    void ctx;
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

    return {
      pdf_url: pdfUrl,
      pdf_base64: pdfBuffer.toString("base64"),
      size_bytes: pdfBuffer.length,
      filename: fileName,
    };
  },

  "action_image": async ({ config, ctx }) => {
    const imgAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const imgInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), imgAllData);
        if (val !== undefined) return String(val);
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
      return meta;
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
    return { base64: outBuf.toString("base64"), format, size_bytes: outBuf.length };
  },

  "action_qrcode": async ({ config, ctx }) => {
    const qrAllData = { ...ctx.triggerData, ...ctx.nodeOutputs };
    const qrInterp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), qrAllData);
        if (val !== undefined) return String(val);
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
      return { svg, text };
    } else if (fmt === "terminal") {
      const ascii = await QRCode.toString(text, { type: "terminal" });
      return { ascii, text };
    } else {
      const dataUrl = await QRCode.toDataURL(text, opts);
      const base64 = dataUrl.replace("data:image/png;base64,", "");
      return { base64, data_url: dataUrl, text };
    }
  },

  "action_wordpress": async ({ config, interpolate }) => {
    const siteUrl = (config.site_url as string || "").replace(/\/$/, "");
    const username = config.username as string;
    const appPassword = config.app_password as string;
    const action = (config.action as string) || "create_post";
    if (!siteUrl || !username || !appPassword) throw new Error("WordPress site URL, username, and app password are required");
    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const base = `${siteUrl}/wp-json/wp/v2`;
    if (action === "create_post") {
      const body: Record<string, unknown> = { title: interpolate(config.title as string || ""), content: interpolate(config.content as string || ""), status: config.status as string || "draft" };
      const res = await fetch(`${base}/posts`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WordPress ${res.status}`);
      return data;
    } else if (action === "update_post") {
      const body: Record<string, unknown> = {};
      if (config.title) body.title = interpolate(config.title as string);
      if (config.content) body.content = interpolate(config.content as string);
      if (config.status) body.status = config.status;
      const res = await fetch(`${base}/posts/${config.post_id}`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WordPress ${res.status}`);
      return data;
    } else if (action === "get_post") {
      const res = await fetch(`${base}/posts/${config.post_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WordPress ${res.status}`);
      return data;
    } else if (action === "list_posts") {
      const res = await fetch(`${base}/posts?per_page=20`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WordPress ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_contentful": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const spaceId = config.space_id as string;
    const envId = (config.environment_id as string) || "master";
    const action = (config.action as string) || "create_entry";
    if (!token || !spaceId) throw new Error("Contentful token and space ID are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.contentful.management.v1+json" };
    const base = `https://api.contentful.com/spaces/${spaceId}/environments/${envId}`;
    if (action === "create_entry") {
      let fields: Record<string, unknown> = {};
      try { fields = JSON.parse(interpolate(config.fields as string || "{}")); } catch { /* ignore */ }
      const res = await fetch(`${base}/entries`, { method: "POST", headers: { ...hdrs, "X-Contentful-Content-Type": config.content_type_id as string || "" }, body: JSON.stringify({ fields }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Contentful ${res.status}`);
      return data;
    } else if (action === "update_entry") {
      let fields: Record<string, unknown> = {};
      try { fields = JSON.parse(interpolate(config.fields as string || "{}")); } catch { /* ignore */ }
      const getRes = await fetch(`${base}/entries/${config.entry_id}`, { headers: hdrs });
      const existing = await getRes.json();
      const res = await fetch(`${base}/entries/${config.entry_id}`, { method: "PUT", headers: { ...hdrs, "X-Contentful-Version": String(existing.sys?.version || 0) }, body: JSON.stringify({ fields }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Contentful ${res.status}`);
      return data;
    } else if (action === "publish_entry") {
      const getRes = await fetch(`${base}/entries/${config.entry_id}`, { headers: hdrs });
      const existing = await getRes.json();
      const res = await fetch(`${base}/entries/${config.entry_id}/published`, { method: "PUT", headers: { ...hdrs, "X-Contentful-Version": String(existing.sys?.version || 0) } });
      return { published: res.ok };
    } else if (action === "get_entry") {
      const res = await fetch(`${base}/entries/${config.entry_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Contentful ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_asana": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "create_task";
    if (!token) throw new Error("Asana Personal Access Token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "create_task") {
      const body: Record<string, unknown> = { name: interpolate(config.name as string || ""), notes: interpolate(config.notes as string || "") };
      if (config.project_id) body.projects = [config.project_id];
      if (config.assignee) body.assignee = config.assignee;
      if (config.due_on) body.due_on = config.due_on;
      const res = await fetch("https://app.asana.com/api/1.0/tasks", { method: "POST", headers: hdrs, body: JSON.stringify({ data: body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.message || `Asana ${res.status}`);
      return data.data;
    } else if (action === "update_task") {
      const taskId = config.task_id as string;
      if (!taskId) throw new Error("Task GID required");
      const body = { name: interpolate(config.name as string || ""), notes: interpolate(config.notes as string || "") };
      const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, { method: "PUT", headers: hdrs, body: JSON.stringify({ data: body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.message || `Asana ${res.status}`);
      return data.data;
    } else if (action === "get_task") {
      const res = await fetch(`https://app.asana.com/api/1.0/tasks/${config.task_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.message || `Asana ${res.status}`);
      return data.data;
    } else if (action === "list_tasks") {
      const url = config.project_id ? `https://app.asana.com/api/1.0/projects/${config.project_id}/tasks` : `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${config.workspace_id || ""}`;
      const res = await fetch(url, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.message || `Asana ${res.status}`);
      return data.data;
    }
    return undefined;
  },

  "action_trello": async ({ config, interpolate }) => {
    const key = config.api_key as string;
    const token = config.token as string;
    const action = (config.action as string) || "create_card";
    if (!key || !token) throw new Error("Trello API key and token are required");
    const base = `https://api.trello.com/1`;
    const auth = `key=${key}&token=${token}`;
    if (action === "create_card") {
      const res = await fetch(`${base}/cards?${auth}&idList=${config.list_id}&name=${encodeURIComponent(interpolate(config.name as string || ""))}&desc=${encodeURIComponent(interpolate(config.desc as string || ""))}&due=${config.due || ""}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Trello ${res.status}`);
      return data;
    } else if (action === "update_card") {
      const res = await fetch(`${base}/cards/${config.card_id}?${auth}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: interpolate(config.name as string || ""), desc: interpolate(config.desc as string || "") }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Trello ${res.status}`);
      return data;
    } else if (action === "get_card") {
      const res = await fetch(`${base}/cards/${config.card_id}?${auth}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Trello ${res.status}`);
      return data;
    } else if (action === "archive_card") {
      const res = await fetch(`${base}/cards/${config.card_id}?${auth}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closed: true }) });
      return { archived: res.ok };
    }
    return undefined;
  },

  "action_monday": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "create_item";
    if (!apiKey) throw new Error("Monday.com API key is required");
    const hdrs = { Authorization: apiKey, "Content-Type": "application/json" };
    if (action === "create_item") {
      const colVals = config.column_values ? JSON.stringify(config.column_values) : "{}";
      const query = `mutation { create_item (board_id: ${config.board_id}, group_id: "${config.group_id || "topics"}", item_name: "${interpolate(config.item_name as string || "")}", column_values: ${JSON.stringify(colVals)}) { id name } }`;
      const res = await fetch("https://api.monday.com/v2", { method: "POST", headers: hdrs, body: JSON.stringify({ query }) });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      return data.data?.create_item;
    } else if (action === "get_item") {
      const query = `query { items (ids: [${config.item_id}]) { id name column_values { id text } } }`;
      const res = await fetch("https://api.monday.com/v2", { method: "POST", headers: hdrs, body: JSON.stringify({ query }) });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      return data.data?.items?.[0];
    }
    return undefined;
  },

  "action_clickup": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "create_task";
    if (!token) throw new Error("ClickUp API key is required");
    const hdrs = { Authorization: token, "Content-Type": "application/json" };
    if (action === "create_task") {
      const body: Record<string, unknown> = { name: interpolate(config.name as string || ""), description: interpolate(config.description as string || "") };
      if (config.priority) body.priority = parseInt(config.priority as string);
      if (config.status) body.status = config.status;
      const res = await fetch(`https://api.clickup.com/api/v2/list/${config.list_id}/task`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.err || `ClickUp ${res.status}`);
      return data;
    } else if (action === "update_task") {
      const body: Record<string, unknown> = {};
      if (config.name) body.name = interpolate(config.name as string);
      if (config.status) body.status = config.status;
      const res = await fetch(`https://api.clickup.com/api/v2/task/${config.task_id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.err || `ClickUp ${res.status}`);
      return data;
    } else if (action === "get_task") {
      const res = await fetch(`https://api.clickup.com/api/v2/task/${config.task_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.err || `ClickUp ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_basecamp": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const accountId = config.account_id as string;
    const projectId = config.project_id as string;
    if (!token || !accountId || !projectId) throw new Error("Access token, account ID, and project ID are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "FlowMake (flowmake.app)" };
    const action = (config.action as string) || "create_message";
    if (action === "create_message") {
      const res = await fetch(`https://3.basecampapi.com/${accountId}/buckets/${projectId}/message_boards/${config.message_board_id}/messages.json`, { method: "POST", headers: hdrs, body: JSON.stringify({ subject: interpolate(config.subject as string || ""), content: interpolate(config.content as string || "") }) });
      const data = await res.json();
      if (!res.ok) throw new Error(`Basecamp ${res.status}`);
      return data;
    } else if (action === "create_todo") {
      const res = await fetch(`https://3.basecampapi.com/${accountId}/buckets/${projectId}/todolists/${config.todolist_id}/todos.json`, { method: "POST", headers: hdrs, body: JSON.stringify({ content: interpolate(config.subject as string || ""), description: interpolate(config.content as string || "") }) });
      const data = await res.json();
      if (!res.ok) throw new Error(`Basecamp ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_todoist": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "create_task";
    if (!token) throw new Error("Todoist API token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (action === "create_task") {
      const body: Record<string, unknown> = { content: interpolate(config.content as string || "") };
      if (config.description) body.description = interpolate(config.description as string);
      if (config.project_id) body.project_id = config.project_id;
      if (config.due_string) body.due_string = config.due_string;
      if (config.priority) body.priority = parseInt(config.priority as string);
      const res = await fetch("https://api.todoist.com/rest/v2/tasks", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(`Todoist ${res.status}`);
      return data;
    } else if (action === "close_task") {
      const res = await fetch(`https://api.todoist.com/rest/v2/tasks/${config.task_id}/close`, { method: "POST", headers: hdrs });
      return { closed: res.ok };
    } else if (action === "get_task") {
      const res = await fetch(`https://api.todoist.com/rest/v2/tasks/${config.task_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(`Todoist ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_zoho_crm": async ({ config }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "create_lead";
    if (!token) throw new Error("Zoho CRM access token is required");
    const hdrs = { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" };
    const moduleMap: Record<string, string> = { create_lead: "Leads", create_contact: "Contacts", create_deal: "Deals" };
    const mod = moduleMap[action] || config.module as string || "Leads";
    let fields: Record<string, unknown> = {};
    try { fields = JSON.parse(config.fields as string || "{}"); } catch { /* ignore */ }
    if (action === "search_records") {
      const res = await fetch(`https://www.zohoapis.com/crm/v3/${mod}/search?criteria=${encodeURIComponent(config.search_criteria as string || "")}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Zoho CRM ${res.status}`);
      return data.data || [];
    } else {
      const res = await fetch(`https://www.zohoapis.com/crm/v3/${mod}`, { method: "POST", headers: hdrs, body: JSON.stringify({ data: [fields] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Zoho CRM ${res.status}`);
      return data.data?.[0];
    }
  },

  "action_close": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "create_lead";
    if (!token) throw new Error("Close CRM API key is required");
    const auth = Buffer.from(`${token}:`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    if (action === "create_lead") {
      const body: Record<string, unknown> = { name: interpolate(config.name as string || "") };
      if (config.email) body.contacts = [{ emails: [{ email: interpolate(config.email as string) }] }];
      const res = await fetch("https://api.close.com/api/v1/lead/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Close ${res.status}`);
      return data;
    } else if (action === "create_contact") {
      const body = { name: interpolate(config.name as string || ""), emails: config.email ? [{ email: interpolate(config.email as string), type: "office" }] : [] };
      const res = await fetch("https://api.close.com/api/v1/contact/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Close ${res.status}`);
      return data;
    } else if (action === "create_activity") {
      const body = { _type: "Note", note: interpolate(config.note as string || "") };
      const res = await fetch("https://api.close.com/api/v1/activity/note/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Close ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_zendesk": async ({ config, interpolate }) => {
    const subdomain = config.subdomain as string;
    const email = config.email as string;
    const apiToken = config.api_token as string;
    const action = (config.action as string) || "create_ticket";
    if (!subdomain || !email || !apiToken) throw new Error("Zendesk subdomain, email, and API token are required");
    const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const base = `https://${subdomain}.zendesk.com/api/v2`;
    if (action === "create_ticket") {
      const body = { ticket: { subject: interpolate(config.subject as string || ""), comment: { body: interpolate(config.body as string || "") }, priority: config.priority as string || "normal" } };
      const res = await fetch(`${base}/tickets.json`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Zendesk ${res.status}`);
      return data.ticket;
    } else if (action === "update_ticket") {
      const upd: Record<string, unknown> = {};
      if (config.status) upd.status = config.status;
      if (config.priority) upd.priority = config.priority;
      const res = await fetch(`${base}/tickets/${config.ticket_id}.json`, { method: "PUT", headers: hdrs, body: JSON.stringify({ ticket: upd }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Zendesk ${res.status}`);
      return data.ticket;
    } else if (action === "get_ticket") {
      const res = await fetch(`${base}/tickets/${config.ticket_id}.json`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Zendesk ${res.status}`);
      return data.ticket;
    }
    return undefined;
  },

  "action_intercom": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const action = (config.action as string) || "create_contact";
    if (!token) throw new Error("Intercom access token is required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Intercom-Version": "2.10" };
    if (action === "create_contact") {
      const body: Record<string, unknown> = { role: "user" };
      if (config.email) body.email = interpolate(config.email as string);
      if (config.name) body.name = interpolate(config.name as string);
      const res = await fetch("https://api.intercom.io/contacts", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Intercom ${res.status}`);
      return data;
    } else if (action === "update_contact") {
      const body: Record<string, unknown> = {};
      if (config.email) body.email = interpolate(config.email as string);
      if (config.name) body.name = interpolate(config.name as string);
      const res = await fetch(`https://api.intercom.io/contacts/${config.contact_id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Intercom ${res.status}`);
      return data;
    } else if (action === "create_note") {
      const body = { contact_id: config.contact_id, body: interpolate(config.body as string || "") };
      const res = await fetch("https://api.intercom.io/notes", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Intercom ${res.status}`);
      return data;
    } else if (action === "send_message") {
      const body = { from: { type: "admin", id: "0" }, to: { type: "user", id: config.contact_id }, body: interpolate(config.body as string || ""), message_type: "inapp" };
      const res = await fetch("https://api.intercom.io/messages", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Intercom ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_freshdesk": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const domain = config.domain as string;
    const action = (config.action as string) || "create_ticket";
    if (!apiKey || !domain) throw new Error("Freshdesk API key and domain are required");
    const auth = Buffer.from(`${apiKey}:X`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const base = `https://${domain}/api/v2`;
    if (action === "create_ticket") {
      const body: Record<string, unknown> = { subject: interpolate(config.subject as string || ""), description: interpolate(config.description as string || ""), email: interpolate(config.email as string || "") };
      if (config.priority) body.priority = parseInt(config.priority as string);
      if (config.status) body.status = parseInt(config.status as string);
      const res = await fetch(`${base}/tickets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Freshdesk ${res.status}`);
      return data;
    } else if (action === "update_ticket") {
      const body: Record<string, unknown> = {};
      if (config.status) body.status = parseInt(config.status as string);
      if (config.priority) body.priority = parseInt(config.priority as string);
      const res = await fetch(`${base}/tickets/${config.ticket_id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Freshdesk ${res.status}`);
      return data;
    } else if (action === "get_ticket") {
      const res = await fetch(`${base}/tickets/${config.ticket_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || `Freshdesk ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_activecampaign": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const baseUrl = (config.base_url as string || "").replace(/\/$/, "");
    const action = (config.action as string) || "create_contact";
    if (!token || !baseUrl) throw new Error("ActiveCampaign API key and URL are required");
    const hdrs = { "Api-Token": token, "Content-Type": "application/json" };
    if (action === "create_contact") {
      const body = { contact: { email: interpolate(config.email as string || ""), firstName: interpolate(config.first_name as string || ""), lastName: interpolate(config.last_name as string || "") } };
      const res = await fetch(`${baseUrl}/api/3/contact/sync`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `ActiveCampaign ${res.status}`);
      return data.contact;
    } else if (action === "add_tag") {
      // First resolve tag id, then apply
      const tagRes = await fetch(`${baseUrl}/api/3/tags?search=${encodeURIComponent(config.tag as string || "")}`, { headers: hdrs });
      const tagData = await tagRes.json();
      const tagId = tagData.tags?.[0]?.id;
      if (!tagId) { return { added: false, reason: "Tag not found" }; }
      const contactRes = await fetch(`${baseUrl}/api/3/contacts?email=${encodeURIComponent(interpolate(config.email as string || ""))}`, { headers: hdrs });
      const contactData = await contactRes.json();
      const contactId = contactData.contacts?.[0]?.id;
      if (!contactId) { return { added: false, reason: "Contact not found" }; }
      const res = await fetch(`${baseUrl}/api/3/contactTags`, { method: "POST", headers: hdrs, body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }) });
      const data = await res.json();
      return data.contactTag || data;
    }
    return undefined;
  },

  "action_klaviyo": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "track_event";
    if (!token) throw new Error("Klaviyo API key is required");
    const hdrs = { Authorization: `Klaviyo-API-Key ${token}`, "Content-Type": "application/json", revision: "2024-02-15" };
    if (action === "track_event") {
      let props: Record<string, unknown> = {};
      try { props = JSON.parse(interpolate(config.properties as string || "{}")); } catch { /* ignore */ }
      const body = { data: { type: "event", attributes: { properties: props, metric: { data: { type: "metric", attributes: { name: interpolate(config.event as string || "Event") } } }, profile: { data: { type: "profile", attributes: { email: interpolate(config.email as string || "") } } } } } };
      const res = await fetch("https://a.klaviyo.com/api/events/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Klaviyo ${res.status}`); }
      return { tracked: true, event: config.event };
    } else if (action === "upsert_profile") {
      let props: Record<string, unknown> = {};
      try { props = JSON.parse(interpolate(config.properties as string || "{}")); } catch { /* ignore */ }
      const body = { data: { type: "profile", attributes: { email: interpolate(config.email as string || ""), ...props } } };
      const res = await fetch("https://a.klaviyo.com/api/profile-import/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Klaviyo ${res.status}`);
      return data.data;
    } else if (action === "subscribe_list") {
      const body = { data: { type: "profile-subscription-bulk-create-job", attributes: { profiles: { data: [{ type: "profile", attributes: { email: interpolate(config.email as string || "") } } ] } }, relationships: { list: { data: { type: "list", id: config.list_id } } } } };
      const res = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Klaviyo ${res.status}`); }
      return { subscribed: true };
    }
    return undefined;
  },

  "action_convertkit": async ({ config, interpolate }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "subscribe";
    if (!apiKey) throw new Error("ConvertKit API key is required");
    const base = "https://api.convertkit.com/v3";
    if (action === "subscribe") {
      const body = { api_key: apiKey, email: interpolate(config.email as string || ""), first_name: interpolate(config.first_name as string || "") };
      const res = await fetch(`${base}/forms/${config.form_id}/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `ConvertKit ${res.status}`);
      return data.subscription;
    } else if (action === "add_tag") {
      const res = await fetch(`${base}/tags/${config.tag_id}/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey, email: interpolate(config.email as string || "") }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `ConvertKit ${res.status}`);
      return data.subscription;
    } else if (action === "unsubscribe") {
      const res = await fetch(`${base}/unsubscribe`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey, email: interpolate(config.email as string || "") }) });
      const data = await res.json();
      return data;
    }
    return undefined;
  },

  "action_brevo": async ({ config, interpolate }) => {
    const token = config.api_key as string;
    const action = (config.action as string) || "send_email";
    if (!token) throw new Error("Brevo API key is required");
    const hdrs = { "api-key": token, "Content-Type": "application/json" };
    if (action === "send_email") {
      const body = { sender: { email: "noreply@flowmake.app", name: "FlowMake" }, to: [{ email: interpolate(config.to_email as string || ""), name: interpolate(config.to_name as string || "") }], subject: interpolate(config.subject as string || ""), htmlContent: interpolate(config.html_content as string || "") };
      const res = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Brevo ${res.status}`);
      return { sent: true, messageId: data.messageId };
    } else if (action === "upsert_contact") {
      const body: Record<string, unknown> = { email: interpolate(config.to_email as string || "") };
      const res = await fetch("https://api.brevo.com/v3/contacts", { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      return data;
    }
    return undefined;
  },

  "action_user_table": async ({ config, ctx }) => {
    const supabase = createServerClient();
    const tableId = config.table_id as string;
    const action = (config.action as string) || "insert";
    if (!tableId) throw new Error("Table ID is required");

    // Interpolation helper
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
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
      return { inserted: true, id: inserted.id, data: inserted.data };
    } else if (action === "query") {
      const filter = parseJson(config.filter);
      const limit = Math.min(Number(config.limit || 100), 1000);
      let q = supabase.from("user_table_rows").select("id, data, created_at").eq("table_id", tableId);
      for (const [k, v] of Object.entries(filter)) {
        q = q.filter(`data->>${k}`, "eq", String(v));
      }
      const { data: rows, error } = await q.limit(limit).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { rows: (rows ?? []).map(r => ({ id: r.id, ...r.data as object, _created_at: r.created_at })), count: rows?.length ?? 0 };
    } else if (action === "update") {
      const filter = parseJson(config.filter);
      const rowData = parseJson(config.data);
      let q = supabase.from("user_table_rows").update({ data: rowData }).eq("table_id", tableId);
      for (const [k, v] of Object.entries(filter)) {
        q = q.filter(`data->>${k}`, "eq", String(v));
      }
      const { data: updated, error } = await q.select();
      if (error) throw new Error(error.message);
      return { updated: true, affected_rows: updated?.length ?? 0 };
    } else if (action === "delete") {
      const filter = parseJson(config.filter);
      let q = supabase.from("user_table_rows").delete().eq("table_id", tableId);
      for (const [k, v] of Object.entries(filter)) {
        q = q.filter(`data->>${k}`, "eq", String(v));
      }
      const { error } = await q;
      if (error) throw new Error(error.message);
      return { deleted: true };
    } else if (action === "count") {
      const filter = parseJson(config.filter);
      let q = supabase.from("user_table_rows").select("id", { count: "exact", head: true }).eq("table_id", tableId);
      for (const [k, v] of Object.entries(filter)) {
        q = q.filter(`data->>${k}`, "eq", String(v));
      }
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return { count: count ?? 0 };
    }
    return undefined;
  },

  "action_http": async ({ config, ctx, interpolate }) => {
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
    const allData: Record<string, unknown> = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    if (rawBody && method !== "GET" && method !== "DELETE") {
      fetchOptions.body = interpolate(rawBody);
    } else if (!rawBody && method !== "GET" && method !== "DELETE") {
      fetchOptions.body = JSON.stringify(allData);
    }
    const res = await fetch(url, fetchOptions);
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    return { status: res.status, ok: res.ok, data };
  },

  "action_formatter": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const resolveVal = (v: string): unknown => {
      if (!v.includes("{{")) return v;
      return v.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
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
    return { result, original: value, operation };
  },

  "action_csv_parse": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const interp = (str: string) =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const val = path.trim().split(".").reduce<unknown>((o, k) => {
          if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
          return undefined;
        }, allData);
        if (val !== undefined) return String(val);
        if (path.trim().startsWith("secret.")) { const sName = path.trim().slice(7); return ctx.secrets[sName] ?? ""; }
        return "";
      });
    const csv = interp(config.csv as string || "");
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
    return { rows, count: rows.length };
  },

  "action_csv_generate": async ({ config, ctx }) => {
    const allData = { ...ctx.triggerData, ...ctx.nodeOutputs, variables: ctx.variables };
    const delimiter = (config.delimiter as string) || ",";
    let data: unknown[];
    const raw = (config.data as string) || "";
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
    if (!Array.isArray(data) || data.length === 0) { return { csv: "", count: 0 }; }
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
    return { csv, count: data.length, headers };
  },
};
