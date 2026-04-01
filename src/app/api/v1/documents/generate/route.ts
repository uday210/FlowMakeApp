/**
 * POST /api/v1/documents/generate
 *
 * Public API — authenticated via Bearer API key.
 * Generate a document by merging data into a DOCX template.
 *
 * Headers:
 *   Authorization: Bearer sk_live_<your_api_key>
 *   Content-Type: application/json
 *
 * Body:
 * {
 *   template_id: string,          // ID of the doc template in your org
 *   data: Record<string, unknown>,// Merge data — keys match {fields} in the template
 *   output_name?: string,         // Optional filename (default: "<template_name>_<ts>.docx")
 *   preview?: boolean,            // true = return binary DOCX directly (not saved)
 * }
 *
 * Response (preview: false — default):
 * {
 *   id: string,                   // generated_docs record ID
 *   name: string,                 // output file name
 *   document_url: string,         // signed download URL (valid 1 hour)
 *   file_size: number,            // bytes
 *   warnings: string[],           // non-fatal merge warnings
 *   created_at: string,
 * }
 *
 * Response (preview: true):
 *   Binary DOCX file (Content-Disposition: attachment)
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeyContext } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { mergeDocx } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await getApiKeyContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized — provide a valid Bearer API key" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { template_id, data, output_name, preview = false } = body as {
    template_id?: string;
    data?: Record<string, unknown>;
    output_name?: string;
    preview?: boolean;
  };

  if (!template_id) return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "data must be a JSON object" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch template (scoped to org)
  const { data: tpl, error: tplErr } = await admin
    .from("doc_templates")
    .select("id, name, file_path")
    .eq("id", template_id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.file_path) return NextResponse.json({ error: "Template has no uploaded file" }, { status: 400 });

  // Download DOCX
  const { data: fileData, error: dlErr } = await admin.storage
    .from("doc-templates")
    .download(tpl.file_path);
  if (dlErr || !fileData) return NextResponse.json({ error: "Could not load template file" }, { status: 500 });

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  // Merge
  let mergeResult;
  try {
    mergeResult = await mergeDocx(templateBuffer, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Merge failed: ${msg}` }, { status: 422 });
  }

  // Preview mode — return binary directly
  if (preview) {
    const name = output_name ?? `${tpl.name}_preview.docx`;
    return new NextResponse(new Uint8Array(mergeResult.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(mergeResult.buffer.length),
      },
    });
  }

  // Save to storage
  const ts = Date.now();
  const finalName = output_name ?? `${tpl.name}_${ts}.docx`;
  const outputPath = `${ctx.orgId}/${template_id}/${ts}_${finalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: saveErr } = await admin.storage
    .from("generated-docs")
    .upload(outputPath, mergeResult.buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  // Signed URL (1 hour)
  const { data: signedData } = await admin.storage
    .from("generated-docs")
    .createSignedUrl(outputPath, 3600);

  // Log record
  const { data: genDoc } = await admin
    .from("generated_docs")
    .insert({
      org_id: ctx.orgId,
      template_id: tpl.id,
      template_name: tpl.name,
      name: finalName,
      merge_data: data,
      output_path: outputPath,
      output_format: "docx",
      file_size: mergeResult.buffer.length,
      status: "generated",
    })
    .select("id, name, created_at")
    .single();

  try { await admin.rpc("increment_doc_template_usage", { template_id }); } catch { /* non-fatal */ }

  return NextResponse.json({
    id: genDoc?.id,
    name: finalName,
    document_url: signedData?.signedUrl ?? null,
    file_size: mergeResult.buffer.length,
    warnings: mergeResult.warnings,
    created_at: genDoc?.created_at,
  });
}
