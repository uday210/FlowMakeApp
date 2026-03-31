import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { executeWorkflow } from "@/lib/executor";
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
