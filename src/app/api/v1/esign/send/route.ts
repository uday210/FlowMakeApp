/**
 * POST /api/v1/esign/send
 *
 * Public API — authenticated via Bearer API key.
 *
 * Send a document for signing with dynamic signers.
 *
 * Body:
 * {
 *   document_id: string,           // ID of an esign_document in your org
 *   signers: [
 *     {
 *       email: string,
 *       name?: string,
 *       order?: number,            // for sequential signing (1, 2, 3…)
 *       role?: string,             // for template docs: matches signer_email on fields e.g. "Signer 1"
 *       metadata?: Record<string, unknown>  // custom data returned in webhooks
 *     }
 *   ],
 *   mode?: "sequential" | "parallel",  // default: sequential if orders differ, else parallel
 *   callback_url?: string,         // webhook called after each signing event
 * }
 *
 * Response:
 * {
 *   session_id: string,
 *   document_id: string,
 *   mode: "sequential" | "parallel",
 *   signers: [{ id, email, name, order, status, signing_url, role }]
 * }
 */

import { NextResponse } from "next/server";
import { getApiKeyContext } from "@/lib/apiAuth";
import { getBaseUrl } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, renderEmailTemplate } from "@/lib/emailSender";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  const auth = await getApiKeyContext(request);
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key. Pass: Authorization: Bearer sk_live_..." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const {
    document_id,
    signers,
    mode,
    callback_url,
    email_template_id,
  } = body as {
    document_id: string;
    signers: { email: string; name?: string; order?: number; role?: string; metadata?: Record<string, unknown> }[];
    mode?: "sequential" | "parallel";
    callback_url?: string;
    email_template_id?: string;
  };

  if (!document_id) return NextResponse.json({ error: "document_id is required" }, { status: 400 });
  if (!signers?.length) return NextResponse.json({ error: "signers array is required and must not be empty" }, { status: 400 });

  const baseUrl = getBaseUrl(request);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // Verify document belongs to this org
  const { data: doc, error: docError } = await admin
    .from("esign_documents")
    .select("id, name, is_template")
    .eq("id", document_id)
    .eq("org_id", auth.orgId)
    .single();

  if (docError || !doc) return NextResponse.json({ error: "Document not found in your org" }, { status: 404 });

  // Assign order if not provided
  const ordered = signers.map((s, i) => ({
    ...s,
    order: s.order ?? i + 1,
    name: s.name ?? s.email,
  }));
  ordered.sort((a, b) => a.order - b.order);

  // Determine mode
  const hasExplicitOrders = signers.some(s => s.order !== undefined);
  const effectiveMode = mode ?? (hasExplicitOrders && ordered.length > 1 ? "sequential" : "parallel");

  const sessionId = crypto.randomUUID();
  const results = [];

  for (const signer of ordered) {
    // In sequential mode: first signer is pending, rest are waiting
    // In parallel mode: all are pending
    const status = effectiveMode === "parallel" || signer.order === 1 ? "pending" : "waiting";

    const { data: req, error } = await admin
      .from("esign_requests")
      .insert({
        document_id,
        document_title: doc.name,
        document_content: "",
        signer_email: signer.email,
        signer_name: signer.name,
        signer_role: signer.role ?? null,
        status,
        signing_order: signer.order,
        session_id: sessionId,
        callback_url: callback_url ?? null,
        metadata: signer.metadata ?? {},
        org_id: auth.orgId,
      })
      .select("id, token, status")
      .single();

    if (error) return NextResponse.json({ error: `Failed to create request for ${signer.email}: ${error.message}` }, { status: 500 });

    results.push({
      id: req.id,
      email: signer.email,
      name: signer.name,
      order: signer.order,
      role: signer.role ?? null,
      status: req.status,
      signing_url: req.status === "pending" ? `${baseUrl}/sign/${req.token}` : null,
    });
  }

  // Mark document as sent — skip for templates so their status stays reusable
  if (!doc.is_template) {
    await admin.from("esign_documents").update({ status: "sent" }).eq("id", document_id);
  }

  // Send emails to pending signers if a template is attached
  if (email_template_id) {
    const baseUrl = getBaseUrl(request);
    for (const signer of results.filter((r) => r.status === "pending")) {
      const rendered = await renderEmailTemplate(email_template_id, {
        signer_name:    signer.name || signer.email,
        signer_email:   signer.email,
        document_title: doc.name,
        signing_url:    signer.signing_url ?? "",
        org_name:       auth.orgId,
      });
      if (rendered) {
        await sendEmail({
          orgId:    auth.orgId,
          to:       signer.email,
          toName:   signer.name,
          subject:  rendered.subject || `Please sign: ${doc.name}`,
          htmlBody: rendered.htmlBody,
          plainBody: rendered.plainBody,
        });
      }
    }
    void baseUrl; // used in signing_url construction above
  }

  return NextResponse.json({
    session_id: sessionId,
    document_id,
    document_name: doc.name,
    mode: effectiveMode,
    signers: results,
    emails_sent: !!email_template_id,
  }, { status: 201 });
}
