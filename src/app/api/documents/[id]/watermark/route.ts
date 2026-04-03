import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { PDFDocument, rgb, degrees } from "pdf-lib";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function applyWatermarkToPdf(pdfBytes: Uint8Array, text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) * 0.07;
    const textWidth = text.length * fontSize * 0.55;
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - fontSize / 2,
      size: fontSize,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.25,
      rotate: degrees(45),
    });
  }
  return pdfDoc.save();
}

// POST /api/documents/[id]/watermark — apply watermark
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: "Watermark text is required" }, { status: 400 });

  const { data: doc, error: docErr } = await ctx.admin
    .from("esign_documents")
    .select("file_path, file_url, original_file_path, watermark_text")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (docErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The source to watermark is always the original (if we've watermarked before)
  const sourcePath = (doc.original_file_path as string | null) || (doc.file_path as string);
  const supabase = createServerClient();

  // Download source file
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("esign-documents")
    .download(sourcePath);

  if (dlErr || !fileData) return NextResponse.json({ error: "Failed to download file" }, { status: 500 });

  const sourceBytes = new Uint8Array(await fileData.arrayBuffer());
  const watermarkedBytes = await applyWatermarkToPdf(sourceBytes, text.trim());

  // Upload watermarked version (consistent name so upsert works)
  const watermarkedPath = `${id}-watermarked.pdf`;
  const { error: upErr } = await supabase.storage
    .from("esign-documents")
    .upload(watermarkedPath, watermarkedBytes, { contentType: "application/pdf", upsert: true });

  if (upErr) return NextResponse.json({ error: "Failed to upload watermarked file" }, { status: 500 });

  const { data: urlData } = supabase.storage.from("esign-documents").getPublicUrl(watermarkedPath);

  // Update doc: save original_file_path once, update current file to watermarked
  const patch: Record<string, unknown> = {
    file_path: watermarkedPath,
    file_url: urlData.publicUrl,
    watermark_text: text.trim(),
  };
  if (!doc.original_file_path) {
    patch.original_file_path = sourcePath;
  }

  await ctx.admin.from("esign_documents").update(patch).eq("id", id).eq("org_id", ctx.orgId);

  return NextResponse.json({ watermark_text: text.trim(), file_url: urlData.publicUrl });
}

// DELETE /api/documents/[id]/watermark — remove watermark
export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc, error: docErr } = await ctx.admin
    .from("esign_documents")
    .select("original_file_path")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (docErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const originalPath = doc.original_file_path as string | null;
  if (!originalPath) return NextResponse.json({ error: "No original to restore" }, { status: 400 });

  const supabase = createServerClient();
  const { data: urlData } = supabase.storage.from("esign-documents").getPublicUrl(originalPath);

  await ctx.admin.from("esign_documents").update({
    file_path: originalPath,
    file_url: urlData.publicUrl,
    watermark_text: null,
  }).eq("id", id).eq("org_id", ctx.orgId);

  return NextResponse.json({ file_url: urlData.publicUrl });
}
