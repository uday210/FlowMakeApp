import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { executeWorkflow } from "@/lib/executor";
import { hashKey } from "@/lib/apiAuth";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

async function verifyGithubSignature(body: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

async function verifyStripeSignature(body: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("="))) as Record<string, string>;
  const timestamp = parts["t"];
  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return (parts["v1"] ?? "") === hex;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // Parse body
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(rawBody); } catch { body = { raw: rawBody }; }

  const supabase = createServerClient();

  // Fetch full workflow
  const { data: workflow, error: wfError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (wfError || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (workflow.is_active === false) {
    return NextResponse.json({ error: "Workflow is inactive" }, { status: 503 });
  }

  const triggerNode = (workflow.nodes as WorkflowNode[]).find(
    (n) => n.data?.type?.startsWith("trigger_")
  );
  const triggerType = triggerNode?.data?.type;
  const config = triggerNode?.data?.config ?? {};

  // API key auth for trigger_webhook nodes
  if (triggerType === "trigger_webhook" && config.api_key_id) {
    const authHeader = request.headers.get("authorization") ?? "";
    const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!rawKey) {
      return NextResponse.json({ error: "Unauthorized — API key required" }, { status: 401 });
    }
    const keyHash = await hashKey(rawKey);
    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("id, is_active")
      .eq("id", config.api_key_id as string)
      .eq("key_hash", keyHash)
      .single();
    if (!apiKey || !apiKey.is_active) {
      return NextResponse.json({ error: "Unauthorized — invalid or inactive API key" }, { status: 401 });
    }
    // Update last_used_at non-blocking
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id).then(() => {});
  }

  // GitHub signature verification
  if (triggerType === "trigger_github_event") {
    const secret = config.secret as string;
    const ghSig = headers["x-hub-signature-256"] ?? "";
    if (secret && ghSig) {
      const valid = await verifyGithubSignature(rawBody, ghSig, secret);
      if (!valid) return NextResponse.json({ error: "Invalid GitHub signature" }, { status: 401 });
    }
    const ghEvent = headers["x-github-event"] ?? "";
    const filter = (config.events as string) || "any";
    if (filter !== "any" && ghEvent !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${ghEvent}" filtered` });
    }
    body = { ...body, _github_event: ghEvent };
  }

  // Stripe signature verification
  if (triggerType === "trigger_stripe") {
    const secret = config.webhook_secret as string;
    const stripeSig = headers["stripe-signature"] ?? "";
    if (secret && stripeSig) {
      const valid = await verifyStripeSignature(rawBody, stripeSig, secret);
      if (!valid) return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 401 });
    }
    const stripeEvent = body.type as string;
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && stripeEvent !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${stripeEvent}" filtered` });
    }
  }

  // Slack — HMAC-SHA256 with "v0:" prefix
  if (triggerType === "trigger_slack_event") {
    const signingSecret = config.signing_secret as string;
    const slackSig = headers["x-slack-signature"] ?? "";
    const slackTs = headers["x-slack-request-timestamp"] ?? "";
    if (signingSecret && slackSig) {
      const baseStr = `v0:${slackTs}:${rawBody}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseStr));
      const hex = "v0=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== slackSig) return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
    }
    // Handle Slack URL verification challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }
    const eventType = (body.event as Record<string, unknown>)?.type as string ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _slack_event_type: eventType };
  }

  // HubSpot — HMAC-SHA256
  if (triggerType === "trigger_hubspot") {
    const clientSecret = config.client_secret as string;
    const hubSig = headers["x-hubspot-signature-v3"] ?? headers["x-hubspot-signature"] ?? "";
    if (clientSecret && hubSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== hubSig) return NextResponse.json({ error: "Invalid HubSpot signature" }, { status: 401 });
    }
    const events = Array.isArray(body) ? body : [body];
    const eventType = (events[0] as Record<string,unknown>)?.subscriptionType as string ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && !eventType.includes(filter.replace(".", "").toLowerCase())) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { events, _hubspot_event_type: eventType };
  }

  // Shopify — HMAC-SHA256 base64
  if (triggerType === "trigger_shopify") {
    const webhookSecret = config.webhook_secret as string;
    const shopifySig = headers["x-shopify-hmac-sha256"] ?? "";
    if (webhookSecret && shopifySig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const b64 = Buffer.from(sig).toString("base64");
      if (b64 !== shopifySig) return NextResponse.json({ error: "Invalid Shopify signature" }, { status: 401 });
    }
    const topic = headers["x-shopify-topic"] ?? "";
    const filter = (config.topic as string) || "any";
    if (filter !== "any" && topic !== filter) {
      return NextResponse.json({ skipped: true, reason: `Topic "${topic}" filtered` });
    }
    body = { ...body, _shopify_topic: topic };
  }

  // Jira — no signature, just event filtering
  if (triggerType === "trigger_jira_event") {
    const eventType = body.webhookEvent as string ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _jira_event: eventType };
  }

  // Calendly — HMAC-SHA256
  if (triggerType === "trigger_calendly") {
    const signingKey = config.signing_key as string;
    const calendlySig = headers["calendly-webhook-signature"] ?? "";
    if (signingKey && calendlySig) {
      const [, ts, sig] = calendlySig.match(/t=(\d+),v1=([a-f0-9]+)/) ?? [];
      if (ts && sig) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const computed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}.${rawBody}`));
        const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hex !== sig) return NextResponse.json({ error: "Invalid Calendly signature" }, { status: 401 });
      }
    }
    const event = (body.event as string) ?? "";
    const filter = (config.event as string) || "any";
    if (filter !== "any" && event !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${event}" filtered` });
    }
    body = { ...body, _calendly_event: event };
  }

  // Typeform — HMAC-SHA256 base64
  if (triggerType === "trigger_typeform") {
    const secret = config.secret as string;
    const tfSig = headers["typeform-signature"] ?? "";
    if (secret && tfSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const b64 = "sha256=" + Buffer.from(sig).toString("base64");
      if (b64 !== tfSig) return NextResponse.json({ error: "Invalid Typeform signature" }, { status: 401 });
    }
    const formId = config.form_id as string;
    const bodyFormId = (body.form_response as Record<string,unknown>)?.form_id as string ?? "";
    if (formId && bodyFormId && formId !== bodyFormId) {
      return NextResponse.json({ skipped: true, reason: `Form "${bodyFormId}" filtered` });
    }
  }

  // GitLab — plain token comparison
  if (triggerType === "trigger_gitlab_event") {
    const token = config.token as string;
    const gitlabToken = headers["x-gitlab-token"] ?? "";
    if (token && gitlabToken !== token) {
      return NextResponse.json({ error: "Invalid GitLab token" }, { status: 401 });
    }
    const eventType = headers["x-gitlab-event"] ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _gitlab_event: eventType };
  }

  // PayPal — accept all (cert verification is complex, just pass through with event filtering)
  if (triggerType === "trigger_paypal_webhook") {
    const eventType = (body.event_type as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _paypal_event: eventType };
  }

  // Discord — pass through with event type from body
  if (triggerType === "trigger_discord_event") {
    const eventType = (body.t as string) ?? (body.type as string) ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _discord_event: eventType };
  }

  // Telegram — pass through, optionally verify bot token
  if (triggerType === "trigger_telegram_update") {
    const updateType = Object.keys(body).find(k => k !== "update_id") ?? "";
    const filter = (config.update_type as string) || "any";
    if (filter !== "any" && updateType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Update type "${updateType}" filtered` });
    }
    body = { ...body, _telegram_update_type: updateType };
  }

  // Linear — HMAC-SHA256
  if (triggerType === "trigger_linear_event") {
    const webhookSecret = config.webhook_secret as string;
    const linearSig = headers["linear-signature"] ?? "";
    if (webhookSecret && linearSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== linearSig) return NextResponse.json({ error: "Invalid Linear signature" }, { status: 401 });
    }
    const eventType = (body.type as string) ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _linear_event: eventType };
  }

  // Pipedrive — no signature
  if (triggerType === "trigger_pipedrive") {
    const action = (body.event as string)?.split(".")[1] ?? "";
    const obj = (body.event as string)?.split(".")[0] ?? "";
    const actionFilter = (config.event_action as string) || "any";
    const objFilter = (config.event_object as string) || "any";
    if (actionFilter !== "any" && action !== actionFilter) {
      return NextResponse.json({ skipped: true, reason: `Action "${action}" filtered` });
    }
    if (objFilter !== "any" && obj !== objFilter) {
      return NextResponse.json({ skipped: true, reason: `Object "${obj}" filtered` });
    }
    body = { ...body, _pipedrive_event: body.event };
  }

  // WooCommerce — HMAC-SHA256 base64
  if (triggerType === "trigger_woocommerce") {
    const webhookSecret = config.webhook_secret as string;
    const wcSig = headers["x-wc-webhook-signature"] ?? "";
    if (webhookSecret && wcSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const b64 = Buffer.from(sig).toString("base64");
      if (b64 !== wcSig) return NextResponse.json({ error: "Invalid WooCommerce signature" }, { status: 401 });
    }
    const topic = headers["x-wc-webhook-topic"] ?? "";
    const filter = (config.topic as string) || "any";
    if (filter !== "any" && topic !== filter) {
      return NextResponse.json({ skipped: true, reason: `Topic "${topic}" filtered` });
    }
    body = { ...body, _wc_topic: topic };
  }

  // ClickUp — HMAC-SHA256
  if (triggerType === "trigger_clickup") {
    const webhookSecret = config.webhook_secret as string;
    const cuSig = headers["x-signature"] ?? "";
    if (webhookSecret && cuSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== cuSig) return NextResponse.json({ error: "Invalid ClickUp signature" }, { status: 401 });
    }
    const eventType = (body.event as string) ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _clickup_event: eventType };
  }

  // Asana — HMAC-SHA256
  if (triggerType === "trigger_asana") {
    const webhookSecret = config.webhook_secret as string;
    const asanaSig = headers["x-hook-signature"] ?? "";
    if (webhookSecret && asanaSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== asanaSig) return NextResponse.json({ error: "Invalid Asana signature" }, { status: 401 });
    }
    // Asana handshake: respond to X-Hook-Secret with same value
    const hookSecret = headers["x-hook-secret"];
    if (hookSecret) {
      return new Response(null, { status: 200, headers: { "X-Hook-Secret": hookSecret } });
    }
    body = { ...body };
  }

  // Zendesk — no signature, just event filtering
  if (triggerType === "trigger_zendesk") {
    const eventType = (body.type as string) ?? (body.event as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _zendesk_event: eventType };
  }

  // Intercom — HMAC-SHA256
  if (triggerType === "trigger_intercom") {
    const clientSecret = config.client_secret as string;
    const intercomSig = headers["x-hub-signature"] ?? "";
    if (clientSecret && intercomSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== intercomSig) return NextResponse.json({ error: "Invalid Intercom signature" }, { status: 401 });
    }
    const topic = (body.topic as string) ?? "";
    const filter = (config.topic as string) || "any";
    if (filter !== "any" && topic !== filter) {
      return NextResponse.json({ skipped: true, reason: `Topic "${topic}" filtered` });
    }
    body = { ...body, _intercom_topic: topic };
  }

  // Freshdesk — no signature
  if (triggerType === "trigger_freshdesk") {
    const eventType = (body.event as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _freshdesk_event: eventType };
  }

  // Square — HMAC-SHA256 base64
  if (triggerType === "trigger_square_webhook") {
    const signatureKey = config.signature_key as string;
    const squareSig = headers["x-square-hmacsha256-signature"] ?? "";
    if (signatureKey && squareSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(signatureKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const b64 = Buffer.from(sig).toString("base64");
      if (b64 !== squareSig) return NextResponse.json({ error: "Invalid Square signature" }, { status: 401 });
    }
    const eventType = (body.type as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _square_event: eventType };
  }

  // Paddle — HMAC-SHA256
  if (triggerType === "trigger_paddle") {
    const secretKey = config.secret_key as string;
    const paddleSig = headers["paddle-signature"] ?? "";
    if (secretKey && paddleSig) {
      const [, ts, h1] = paddleSig.match(/ts=(\d+);h1=([a-f0-9]+)/) ?? [];
      if (ts && h1) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const computed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
        const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hex !== h1) return NextResponse.json({ error: "Invalid Paddle signature" }, { status: 401 });
      }
    }
    const eventType = (body.event_type as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _paddle_event: eventType };
  }

  // Tally — HMAC-SHA256 base64
  if (triggerType === "trigger_tally") {
    const signingSecret = config.signing_secret as string;
    const tallySig = headers["tally-signature"] ?? "";
    if (signingSecret && tallySig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const b64 = Buffer.from(sig).toString("base64");
      if (b64 !== tallySig) return NextResponse.json({ error: "Invalid Tally signature" }, { status: 401 });
    }
    const formId = config.form_id as string;
    const bodyFormId = (body.data as Record<string,unknown>)?.formId as string ?? "";
    if (formId && bodyFormId && formId !== bodyFormId) {
      return NextResponse.json({ skipped: true, reason: `Form "${bodyFormId}" filtered` });
    }
  }

  // Bitbucket — X-Event-Key header, optional token
  if (triggerType === "trigger_bitbucket_event") {
    const eventKey = headers["x-event-key"] ?? "";
    const filter = (config.event_filter as string) || "any";
    if (filter !== "any" && eventKey !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventKey}" filtered` });
    }
    body = { ...body, _bitbucket_event: eventKey };
  }

  // Sentry — HMAC-SHA256
  if (triggerType === "trigger_sentry_alert") {
    const clientSecret = config.client_secret as string;
    const sentrySig = headers["sentry-hook-signature"] ?? "";
    if (clientSecret && sentrySig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== sentrySig) return NextResponse.json({ error: "Invalid Sentry signature" }, { status: 401 });
    }
    const action = headers["sentry-hook-resource"] ?? (body.action as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && action !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${action}" filtered` });
    }
    body = { ...body, _sentry_event: action };
  }

  // PagerDuty — no standard signature, just event filtering
  if (triggerType === "trigger_pagerduty") {
    const messages = Array.isArray(body.messages) ? body.messages as Record<string,unknown>[] : [];
    const eventType = messages[0]?.event as string ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _pagerduty_event: eventType };
  }

  // Datadog — HMAC-SHA256
  if (triggerType === "trigger_datadog") {
    const signingSecret = config.signing_secret as string;
    const ddSig = headers["dd-signature"] ?? "";
    if (signingSecret && ddSig) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex !== ddSig) return NextResponse.json({ error: "Invalid Datadog signature" }, { status: 401 });
    }
    const eventType = (body.event_type as string) ?? "";
    const filter = (config.event_type as string) || "any";
    if (filter !== "any" && eventType !== filter) {
      return NextResponse.json({ skipped: true, reason: `Event "${eventType}" filtered` });
    }
    body = { ...body, _datadog_event: eventType };
  }

  const triggerData = { ...body, _trigger: "webhook", _headers: headers };

  // Collect connection configs
  const nodes = workflow.nodes as WorkflowNode[];
  const connectionIds = [...new Set(
    nodes.map((n) => n.data?.config?.connectionId as string | undefined).filter(Boolean) as string[]
  )];
  const connectionsMap: Record<string, Record<string, unknown>> = {};
  if (connectionIds.length > 0) {
    const { data: conns } = await supabase.from("connections").select("id, config").in("id", connectionIds);
    for (const conn of conns ?? []) {
      connectionsMap[conn.id] = conn.config as Record<string, unknown>;
    }
  }

  // Create execution record
  const { data: execution } = await supabase
    .from("executions")
    .insert({ workflow_id: id, status: "running", trigger_data: triggerData, logs: [] })
    .select()
    .single();

  // Run workflow directly (no HTTP self-call)
  let finalStatus: "success" | "failed" = "success";
  let ctx;
  try {
    ctx = await executeWorkflow(
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[],
      triggerData,
      connectionsMap,
      id,
      workflow.org_id as string | undefined
    );
    if (ctx.logs.some((l) => l.status === "error")) finalStatus = "failed";
  } catch (err) {
    finalStatus = "failed";
    ctx = { logs: [{ node_id: "webhook", node_label: "Webhook", status: "error" as const, error: String(err), output: undefined }] };
  }

  if (execution) {
    await supabase.from("executions").update({
      status: finalStatus,
      logs: ctx.logs,
      finished_at: new Date().toISOString(),
    }).eq("id", execution.id);
  }

  // If a Webhook Response node ran, return its configured body
  const webhookResponseLog = ctx.logs.find(
    (l) => l.node_label === "Webhook Response" && l.status === "success"
  );
  if (webhookResponseLog?.output) {
    const out = webhookResponseLog.output as { status?: number; body?: string };
    const httpStatus = Number(out.status ?? 200);
    const responseBody = out.body ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(responseBody); } catch { /* not JSON */ }
    if (parsed !== undefined) return NextResponse.json(parsed, { status: httpStatus });
    return new Response(responseBody, { status: httpStatus, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ status: finalStatus, logs: ctx.logs });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const h = _request.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  return NextResponse.json({
    message: "Webhook endpoint ready",
    workflow_id: id,
    webhook_url: `${baseUrl}/api/webhook/${id}`,
    form_url: `${baseUrl}/form/${id}`,
    method: "POST",
  });
}
