import type { NodeHandler } from "./types";
import { createServerClient } from "../supabase";

export const handlers: Record<string, NodeHandler> = {
  "trigger_esign": async ({ ctx }) => {
    return ctx.triggerData;
  },

  "action_esign_request": async ({ config, ctx }) => {
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

    return {
      request_id: req.id,
      token: req.token,
      signing_url: signingUrl,
      signer_email: signerEmail,
      document_title: resolvedTitle,
      status: "pending",
    };
  },

  "action_send_esign_template": async ({ config, ctx, interpolate }) => {
    const documentId = interpolate(config.document_id as string);
    if (!documentId) throw new Error("Document template is required");

    const signerFields = [
      { email: interpolate(config.signer1_email as string), name: interpolate(config.signer1_name as string) },
      { email: interpolate(config.signer2_email as string), name: interpolate(config.signer2_name as string) },
      { email: interpolate(config.signer3_email as string), name: interpolate(config.signer3_name as string) },
    ].filter(s => s.email.trim());

    if (!signerFields.length) throw new Error("At least one signer email is required");

    const mode = (config.mode as string) || "sequential";
    const emailTemplateId = interpolate(config.email_template_id as string);

    const supabase = createServerClient();

    // Fetch document (service role bypasses RLS; filter by org if available)
    let docQuery = supabase
      .from("esign_documents")
      .select("id, name, email_template_id")
      .eq("id", documentId);
    if (ctx.orgId) docQuery = docQuery.eq("org_id", ctx.orgId);
    const { data: doc, error: docError } = await docQuery.single();
    if (docError || !doc) throw new Error("Document template not found");

    const effectiveTemplateId = emailTemplateId || (doc as { email_template_id?: string }).email_template_id || null;
    const sessionId = crypto.randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const results = [];

    for (let i = 0; i < signerFields.length; i++) {
      const signer = signerFields[i];
      const order = i + 1;
      const status = mode === "parallel" || order === 1 ? "pending" : "waiting";

      const { data: req, error: reqErr } = await supabase
        .from("esign_requests")
        .insert({
          document_id: documentId,
          document_title: doc.name,
          document_content: "",
          signer_email: signer.email,
          signer_name: signer.name || signer.email,
          status,
          signing_order: order,
          session_id: sessionId,
          org_id: ctx.orgId || null,
        })
        .select("id, token, status")
        .single();
      if (reqErr || !req) throw new Error(`Failed to create request for ${signer.email}: ${reqErr?.message}`);

      results.push({
        id: req.id,
        email: signer.email,
        name: signer.name || signer.email,
        order,
        status: req.status,
        signing_url: req.status === "pending" ? `${baseUrl}/sign/${req.token}` : null,
      });
    }

    // Send invitation emails to pending signers
    if (effectiveTemplateId) {
      const { sendEmail, renderEmailTemplate } = await import("../emailSender");
      for (const signer of results.filter(r => r.status === "pending")) {
        try {
          const rendered = await renderEmailTemplate(effectiveTemplateId, {
            signer_name: signer.name,
            signer_email: signer.email,
            document_title: doc.name,
            signing_url: signer.signing_url ?? "",
          });
          if (rendered) {
            await sendEmail({
              orgId: ctx.orgId ?? "",
              to: signer.email,
              toName: signer.name,
              subject: rendered.subject || `Please sign: ${doc.name}`,
              htmlBody: rendered.htmlBody,
              plainBody: rendered.plainBody,
            });
          }
        } catch {
          // non-fatal
        }
      }
    }

    return {
      session_id: sessionId,
      document_id: documentId,
      document_name: doc.name,
      mode,
      signers: results,
      emails_sent: !!effectiveTemplateId,
    };
  },

  "action_generate_document": async ({ config, ctx, interpolate }) => {
    const templateId = interpolate(config.template_id as string);
    if (!templateId) throw new Error("Document template is required");

    const rawOutputName = interpolate((config.output_name as string) || "");
    const dataRaw = interpolate((config.data as string) || "{}");

    let mergeData: Record<string, unknown> = {};
    try {
      mergeData = typeof dataRaw === "string" ? JSON.parse(dataRaw) : (dataRaw as Record<string, unknown>);
    } catch {
      throw new Error("Merge Data must be valid JSON");
    }

    const docSupabase = createServerClient();

    // Fetch template record
    const { data: docTpl, error: docTplErr } = await docSupabase
      .from("doc_templates")
      .select("id, name, file_path, org_id")
      .eq("id", templateId)
      .eq("org_id", ctx.orgId)
      .single();
    if (docTplErr || !docTpl) throw new Error("Document template not found");
    if (!docTpl.file_path) throw new Error("Template file not uploaded");

    // Download DOCX
    const { data: fileData, error: dlErr } = await docSupabase.storage
      .from("doc-templates")
      .download(docTpl.file_path as string);
    if (dlErr || !fileData) throw new Error("Could not load template file");

    const templateBuffer = Buffer.from(await fileData.arrayBuffer());

    // Merge
    const { mergeDocx } = await import("../docMerge");
    const mergeResult = await mergeDocx(templateBuffer, mergeData);

    // Save output
    const ts = Date.now();
    const outputName = rawOutputName || `${docTpl.name}_${ts}.docx`;
    const outputPath = `${ctx.orgId}/${templateId}/${ts}_${outputName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: saveErr } = await docSupabase.storage
      .from("generated-docs")
      .upload(outputPath, mergeResult.buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
    if (saveErr) throw new Error(`Failed to save document: ${saveErr.message}`);

    const { data: signedData } = await docSupabase.storage
      .from("generated-docs")
      .createSignedUrl(outputPath, 3600);

    const { data: genDoc } = await docSupabase
      .from("generated_docs")
      .insert({
        org_id: ctx.orgId,
        template_id: docTpl.id,
        template_name: docTpl.name,
        name: outputName,
        merge_data: mergeData,
        output_path: outputPath,
        output_format: "docx",
        file_size: mergeResult.buffer.length,
        status: "generated",
        workflow_execution_id: null,
      })
      .select("id")
      .single();

    try { await docSupabase.rpc("increment_doc_template_usage", { template_id: templateId }); } catch { /* non-fatal */ }

    return {
      document_url: signedData?.signedUrl ?? null,
      document_id: genDoc?.id ?? null,
      template_id: templateId,
      output_name: outputName,
      file_size: mergeResult.buffer.length,
    };
  },
};
