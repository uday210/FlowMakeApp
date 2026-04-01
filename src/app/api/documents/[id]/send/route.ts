import { NextResponse } from "next/server";
import { getOrgContext, getBaseUrl } from "@/lib/auth";
import { sendEmail, renderEmailTemplate } from "@/lib/emailSender";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { signers, email_template_id, mode } = await request.json() as {
    signers: { email: string; name: string; order?: number; group?: number }[];
    email_template_id?: string;
    mode?: "sequential" | "parallel" | "groups";
  };

  if (!signers || signers.length === 0) {
    return NextResponse.json({ error: "At least one signer is required" }, { status: 400 });
  }

  const { data: doc, error: docError } = await ctx.admin
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const effectiveMode = mode ?? (signers.length > 1 ? "sequential" : "sequential");

  // Derive signing_order from mode:
  // - parallel: all get order 1 (all pending simultaneously)
  // - groups: use signer.group as the order (multiple per level)
  // - sequential: use signer.order (or auto 1, 2, 3...)
  const ordered = signers.map((s, i) => ({
    ...s,
    signing_order: effectiveMode === "parallel"
      ? 1
      : effectiveMode === "groups"
        ? (s.group ?? i + 1)
        : (s.order ?? i + 1),
  }));
  ordered.sort((a, b) => a.signing_order - b.signing_order);

  const minOrder = ordered.length > 0 ? ordered[0].signing_order : 1;

  const requests = [];
  for (const signer of ordered) {
    // parallel: all pending; sequential/groups: first level pending, rest waiting
    const status = effectiveMode === "parallel" || signer.signing_order === minOrder
      ? "pending"
      : "waiting";

    const { data: req, error } = await ctx.admin
      .from("esign_requests")
      .insert({
        document_id: id,
        document_title: doc.name,
        document_content: "",
        signer_email: signer.email,
        signer_name: signer.name,
        status,
        signing_order: signer.signing_order,
        org_id: ctx.orgId,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    requests.push(req);
  }

  if (!doc.is_template) {
    await ctx.admin.from("esign_documents").update({ status: "sent" }).eq("id", id).eq("org_id", ctx.orgId);
  }

  const baseUrl = getBaseUrl(request);
  const results = requests.map((r) => ({
    id: r.id,
    signer_email: r.signer_email,
    signer_name: r.signer_name,
    signing_order: r.signing_order,
    status: r.status,
    signing_url: r.status === "pending" ? `${baseUrl}/sign/${r.token}` : null,
  }));

  // Increment template usage count
  if (email_template_id) {
    await ctx.admin.rpc("increment_template_usage", { template_id: email_template_id });
  }

  // Send emails to pending signers if a template is attached
  if (email_template_id) {
    const pendingSigners = results.filter((r) => r.status === "pending");
    for (const signer of pendingSigners) {
      const rendered = await renderEmailTemplate(email_template_id, {
        signer_name:    signer.signer_name || signer.signer_email,
        signer_email:   signer.signer_email,
        document_title: doc.name,
        signing_url:    signer.signing_url ?? "",
        org_name:       ctx.orgId,
      });
      if (rendered) {
        await sendEmail({
          orgId:    ctx.orgId,
          to:       signer.signer_email,
          toName:   signer.signer_name,
          subject:  rendered.subject || `Please sign: ${doc.name}`,
          htmlBody: rendered.htmlBody,
          plainBody: rendered.plainBody,
        });
      }
    }
  }

  return NextResponse.json({ success: true, requests: results, emails_sent: !!email_template_id });
}
