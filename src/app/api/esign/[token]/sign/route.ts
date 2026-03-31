import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data: req, error: fetchError } = await supabase
    .from("esign_requests")
    .select("*")
    .eq("token", token)
    .single();

  if (fetchError || !req) {
    return NextResponse.json({ error: "Signing request not found" }, { status: 404 });
  }

  if (req.status === "signed") {
    return NextResponse.json({ error: "Document already signed" }, { status: 409 });
  }

  if (req.status === "waiting") {
    return NextResponse.json({ error: "It is not yet your turn to sign" }, { status: 403 });
  }

  const body = await request.json();
  const { signature_data, signature_type, fields_data } = body as {
    signature_data: string;
    signature_type: "draw" | "type" | "fields";
    fields_data?: Record<string, string>;
  };

  if (!signature_data) {
    return NextResponse.json({ error: "Signature data is required" }, { status: 400 });
  }

  const signedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("esign_requests")
    .update({
      status: "signed",
      signature_data,
      signature_type,
      signed_at: signedAt,
      fields_data: fields_data ?? {},
    })
    .eq("token", token);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // ── Activate next signer in sequence ──────────────────────────────────────
  if (req.document_id) {
    const nextOrder = (req.signing_order ?? 1) + 1;
    const { data: nextSigner } = await supabase
      .from("esign_requests")
      .select("id, token")
      .eq("document_id", req.document_id)
      .eq("signing_order", nextOrder)
      .eq("status", "waiting")
      .single();

    if (nextSigner) {
      await supabase
        .from("esign_requests")
        .update({ status: "pending" })
        .eq("id", nextSigner.id);
    }
  }

  // ── Trigger workflow if linked ─────────────────────────────────────────────
  if (req.workflow_id) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await fetch(`${baseUrl}/api/execute/${req.workflow_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _trigger: "esign",
          request_id: req.id,
          token: req.token,
          document_title: req.document_title,
          signer_email: req.signer_email,
          signer_name: req.signer_name,
          signing_order: req.signing_order,
          signature_type,
          signed_at: signedAt,
        }),
      });
    } catch { /* Non-fatal */ }
  }

  // ── Webhook callback (set via API) ──────────────────────────────────────────
  if (req.callback_url) {
    // Check if all signers in this session are done
    let allDone = false;
    let sessionStatus = "in_progress";
    if (req.session_id) {
      const { data: sessionReqs } = await supabase
        .from("esign_requests")
        .select("id, status")
        .eq("session_id", req.session_id);
      allDone = (sessionReqs ?? []).every(r => r.id === req.id ? true : r.status === "signed");
      if (allDone) sessionStatus = "completed";
    }

    const payload = {
      event: allDone ? "session.completed" : "signer.signed",
      session_id: req.session_id ?? null,
      document_id: req.document_id,
      signer: {
        id: req.id,
        email: req.signer_email,
        name: req.signer_name,
        role: req.signer_role ?? null,
        order: req.signing_order,
        signed_at: signedAt,
        metadata: req.metadata ?? {},
      },
      session_status: sessionStatus,
    };

    try {
      await fetch(req.callback_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* Non-fatal — don't block signing if webhook fails */ }
  }

  return NextResponse.json({ success: true, signed_at: signedAt });
}
