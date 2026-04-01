import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, renderEmailTemplate } from "@/lib/emailSender";
import { getBaseUrl } from "@/lib/auth";

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

  // ── Activate next group when all signers in current group have signed ───────
  // Works for: sequential (group size=1), parallel (no waiting), groups (group size>1)
  if (req.document_id) {
    // Check if every other member of the current signing_order group has also signed
    let groupQuery = supabase
      .from("esign_requests")
      .select("id, status")
      .eq("document_id", req.document_id)
      .eq("signing_order", req.signing_order ?? 1);
    if (req.session_id) groupQuery = groupQuery.eq("session_id", req.session_id);
    const { data: groupMembers } = await groupQuery;

    const allGroupSigned = (groupMembers ?? []).every(
      (m) => m.id === req.id || m.status === "signed"
    );

    if (allGroupSigned) {
      // Find next group: lowest signing_order > current that still has waiting signers
      let nextGroupQuery = supabase
        .from("esign_requests")
        .select("id, token, signer_email, signer_name, signing_order")
        .eq("document_id", req.document_id)
        .eq("status", "waiting")
        .gt("signing_order", req.signing_order ?? 1)
        .order("signing_order", { ascending: true });
      if (req.session_id) nextGroupQuery = nextGroupQuery.eq("session_id", req.session_id);
      const { data: waitingNext } = await nextGroupQuery;

      if (waitingNext && waitingNext.length > 0) {
        const nextOrder = waitingNext[0].signing_order;
        const nextGroup = waitingNext.filter((s) => s.signing_order === nextOrder);

        // Activate all members of the next group simultaneously
        await supabase
          .from("esign_requests")
          .update({ status: "pending" })
          .in("id", nextGroup.map((s) => s.id));

        // Send emails to all next group members if a template is configured
        try {
          const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data: doc } = await admin
            .from("esign_documents")
            .select("name, email_template_id, org_id")
            .eq("id", req.document_id)
            .single();

          if (doc?.email_template_id && doc?.org_id) {
            const baseUrl = getBaseUrl(request);
            for (const nextSigner of nextGroup) {
              const signingUrl = `${baseUrl}/sign/${nextSigner.token}`;
              const rendered = await renderEmailTemplate(doc.email_template_id, {
                signer_name:    nextSigner.signer_name || nextSigner.signer_email,
                signer_email:   nextSigner.signer_email,
                document_title: doc.name,
                signing_url:    signingUrl,
                org_name:       doc.org_id,
              });
              if (rendered) {
                await sendEmail({
                  orgId:    doc.org_id,
                  to:       nextSigner.signer_email,
                  toName:   nextSigner.signer_name,
                  subject:  rendered.subject || `Please sign: ${doc.name}`,
                  htmlBody: rendered.htmlBody,
                  plainBody: rendered.plainBody,
                });
              }
            }
          }
        } catch { /* Non-fatal — don't block signing if email fails */ }
      }
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
