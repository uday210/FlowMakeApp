import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { extractText } from "unpdf";
import { PDFDocument, rgb, degrees } from "pdf-lib";

async function applyWatermark(buffer: Buffer<ArrayBuffer>, text: string): Promise<Buffer<ArrayBuffer>> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) * 0.07;

    // Estimate text width (rough: ~0.55× font size per char)
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

  const watermarked = await pdfDoc.save();
  return Buffer.from(new Uint8Array(watermarked));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const watermarkText = (formData.get("watermark") as string | null)?.trim() ?? "";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();
  let buffer = Buffer.from(new Uint8Array(arrayBuffer));

  // Apply watermark if requested (non-fatal — falls back to original)
  if (watermarkText) {
    try {
      buffer = await applyWatermark(buffer, watermarkText);
    } catch { /* silent — upload original if watermark fails */ }
  }

  const { error: uploadError } = await supabase.storage
    .from("esign-documents")
    .upload(fileName, new Uint8Array(buffer), { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("esign-documents").getPublicUrl(fileName);

  // Extract text for AI assistant context (non-fatal)
  let extractedText = "";
  try {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    extractedText = Array.isArray(text) ? text.join(" ").trim() : (text ?? "").trim();
  } catch { /* silent — upload still succeeds without text */ }

  return NextResponse.json({ file_path: fileName, file_url: urlData.publicUrl, extracted_text: extractedText });
}
