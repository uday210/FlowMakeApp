import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { mergeDocx } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

// POST /api/doc-templates/[id]/generate
// Body: { data: Record<string,unknown>, output_name?: string, preview?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const mergeData: Record<string, unknown> = body.data ?? {};
  const preview: boolean = body.preview ?? false;

  // Fetch template record
  const { data: tpl, error: tplErr } = await ctx.admin
    .from("doc_templates")
    .select("id, name, file_path, file_name, org_id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.file_path) return NextResponse.json({ error: "Template file not uploaded" }, { status: 400 });

  // Download DOCX from storage
  const { data: fileData, error: dlErr } = await ctx.admin.storage
    .from("doc-templates")
    .download(tpl.file_path);

  if (dlErr || !fileData) return NextResponse.json({ error: "Could not load template file" }, { status: 500 });

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  // Merge
  let mergeResult;
  try {
    mergeResult = await mergeDocx(templateBuffer, mergeData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Merge failed: ${msg}` }, { status: 422 });
  }

  // If preview — return the file directly (don't save)
  if (preview) {
    const outputName = body.output_name ?? `${tpl.name}_preview.docx`;
    return new NextResponse(new Uint8Array(mergeResult.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputName}"`,
        "Content-Length": String(mergeResult.buffer.length),
      },
    });
  }

  // Save to generated-docs storage
  const ts = Date.now();
  const outputName = body.output_name ?? `${tpl.name}_${ts}.docx`;
  const outputPath = `${ctx.orgId}/${id}/${ts}_${outputName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: saveErr } = await ctx.admin.storage
    .from("generated-docs")
    .upload(outputPath, mergeResult.buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  // Signed URL (1 hour)
  const { data: signedData } = await ctx.admin.storage
    .from("generated-docs")
    .createSignedUrl(outputPath, 3600);

  // Log generated doc
  const { data: genDoc } = await ctx.admin
    .from("generated_docs")
    .insert({
      org_id: ctx.orgId,
      template_id: tpl.id,
      template_name: tpl.name,
      name: outputName,
      merge_data: mergeData,
      output_path: outputPath,
      output_format: "docx",
      file_size: mergeResult.buffer.length,
      status: "generated",
      workflow_execution_id: body.workflow_execution_id ?? null,
    })
    .select("id, name, created_at")
    .single();

  // Increment usage count
  try { await ctx.admin.rpc("increment_doc_template_usage", { template_id: id }); } catch { /* non-fatal */ }

  return NextResponse.json({
    id: genDoc?.id,
    name: outputName,
    document_url: signedData?.signedUrl ?? null,
    output_path: outputPath,
    file_size: mergeResult.buffer.length,
    warnings: mergeResult.warnings,
    created_at: genDoc?.created_at,
  });
}
