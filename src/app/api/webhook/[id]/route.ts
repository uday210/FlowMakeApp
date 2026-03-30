import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { WorkflowNode } from "@/lib/types";

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

  // Fetch workflow to check trigger type and config
  const supabase = createServerClient();
  const { data: workflow } = await supabase.from("workflows").select("nodes").eq("id", id).single();

  if (workflow) {
    const triggerNode = (workflow.nodes as WorkflowNode[]).find(
      (n) => n.data?.type?.startsWith("trigger_")
    );
    const triggerType = triggerNode?.data?.type;
    const config = triggerNode?.data?.config ?? {};

    // GitHub signature verification
    if (triggerType === "trigger_github_event") {
      const secret = config.secret as string;
      const ghSig = headers["x-hub-signature-256"] ?? "";
      if (secret && ghSig) {
        const valid = await verifyGithubSignature(rawBody, ghSig, secret);
        if (!valid) return NextResponse.json({ error: "Invalid GitHub signature" }, { status: 401 });
      }
      // Filter by event type
      const ghEvent = headers["x-github-event"] ?? "";
      const filter = (config.events as string) || "any";
      if (filter !== "any" && ghEvent !== filter) {
        return NextResponse.json({ skipped: true, reason: `Event "${ghEvent}" filtered (expected "${filter}")` });
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
      // Filter by event type
      const stripeEvent = body.type as string;
      const filter = (config.event_type as string) || "any";
      if (filter !== "any" && stripeEvent !== filter) {
        return NextResponse.json({ skipped: true, reason: `Event "${stripeEvent}" filtered` });
      }
    }
  }

  // Execute workflow
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/execute/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, _trigger: "webhook", _headers: headers }),
  });

  const data = await res.json();

  // If a Webhook Response node ran, return its configured body directly
  const webhookResponseLog = data?.logs?.find(
    (l: { node_label?: string; status?: string; output?: { status?: number; body?: string } }) =>
      l.node_label === "Webhook Response" && l.status === "success"
  );
  if (webhookResponseLog?.output) {
    const { status: httpStatus = 200, body: responseBody = "" } = webhookResponseLog.output;
    // Try to detect if body is JSON
    let parsed: unknown = undefined;
    try { parsed = JSON.parse(responseBody); } catch { /* not JSON */ }
    if (parsed !== undefined) {
      return NextResponse.json(parsed, { status: Number(httpStatus) });
    }
    return new Response(responseBody, {
      status: Number(httpStatus),
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    message: "Webhook endpoint ready",
    workflow_id: id,
    webhook_url: `${baseUrl}/api/webhook/${id}`,
    form_url: `${baseUrl}/form/${id}`,
    method: "POST",
  });
}
