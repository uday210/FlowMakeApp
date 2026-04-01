import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { mergeDocx } from "@/lib/docMerge";

export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ── PDF conversion via puppeteer ──────────────────────────────────────────────

async function generatePdf(docxBuffer: Buffer): Promise<Buffer> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });

  const pdfHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a202c; }
  h1 { font-size: 18pt; font-weight: 700; margin: 10px 0 6px; }
  h2 { font-size: 14pt; font-weight: 700; margin: 8px 0 5px; }
  h3 { font-size: 12pt; font-weight: 600; margin: 6px 0 4px; }
  p { margin: 0 0 6px; }
  strong { font-weight: 700; } em { font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10pt; }
  th { background: #2d3748; color: #fff; padding: 6px 10px; text-align: left; font-size: 9pt; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f7fafc; }
  ul, ol { padding-left: 18px; margin: 0 0 6px; }
  img { max-width: 100%; }
</style>
</head><body>${html}</body></html>`;

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(pdfHtml, { waitUntil: "load", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "72px", right: "72px", bottom: "72px", left: "72px" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// POST /api/doc-templates/[id]/generate
// Body: { data, output_name?, preview?, format?: "docx" | "pdf" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const mergeData: Record<string, unknown> = body.data ?? {};
  const preview: boolean = body.preview ?? false;
  const format: "docx" | "pdf" = body.format === "pdf" ? "pdf" : "docx";

  // Fetch template record
  const { data: tpl, error: tplErr } = await ctx.admin
    .from("doc_templates")
    .select("id, name, file_path, file_name, org_id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (tplErr || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.file_path) return NextResponse.json({ error: "Template file not uploaded" }, { status: 400 });

  // Download DOCX
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

  // Convert to PDF if requested
  let outputBuffer: Buffer;
  let outputMime: string;
  try {
    if (format === "pdf") {
      outputBuffer = await generatePdf(mergeResult.buffer);
      outputMime = "application/pdf";
    } else {
      outputBuffer = mergeResult.buffer;
      outputMime = DOCX_MIME;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `PDF generation failed: ${msg}` }, { status: 500 });
  }

  const baseName = (body.output_name as string | undefined)?.replace(/\.(docx|pdf)$/i, "") ?? tpl.name;
  const outputName = `${baseName}.${format}`;

  // Preview — return binary directly (not saved)
  if (preview) {
    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        "Content-Type": outputMime,
        "Content-Disposition": `attachment; filename="${outputName}"`,
        "Content-Length": String(outputBuffer.length),
      },
    });
  }

  // Save to generated-docs storage
  const ts = Date.now();
  const outputPath = `${ctx.orgId}/${id}/${ts}_${outputName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: saveErr } = await ctx.admin.storage
    .from("generated-docs")
    .upload(outputPath, outputBuffer, { contentType: outputMime, upsert: false });
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  const { data: signedData } = await ctx.admin.storage
    .from("generated-docs")
    .createSignedUrl(outputPath, 3600);

  const { data: genDoc } = await ctx.admin
    .from("generated_docs")
    .insert({
      org_id: ctx.orgId,
      template_id: tpl.id,
      template_name: tpl.name,
      name: outputName,
      merge_data: mergeData,
      output_path: outputPath,
      output_format: format,
      file_size: outputBuffer.length,
      status: "generated",
      workflow_execution_id: body.workflow_execution_id ?? null,
    })
    .select("id, name, created_at")
    .single();

  try { await ctx.admin.rpc("increment_doc_template_usage", { template_id: id }); } catch { /* non-fatal */ }

  return NextResponse.json({
    id: genDoc?.id,
    name: outputName,
    format,
    document_url: signedData?.signedUrl ?? null,
    output_path: outputPath,
    file_size: outputBuffer.length,
    warnings: mergeResult.warnings,
    created_at: genDoc?.created_at,
  });
}
