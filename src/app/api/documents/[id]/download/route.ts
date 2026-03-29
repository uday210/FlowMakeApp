import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  // Fetch document
  const { data: doc, error: docError } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Fetch fields definition
  const { data: fields } = await supabase
    .from("esign_fields")
    .select("*")
    .eq("document_id", id);

  // Fetch all signed requests and their field values
  const { data: requests } = await supabase
    .from("esign_requests")
    .select("*")
    .eq("document_id", id)
    .eq("status", "signed");

  // Build a map of field_id → value from all signed requests
  const fieldValues: Record<string, string> = {};
  for (const req of requests ?? []) {
    let fd = (req.fields_data ?? {}) as Record<string, string>;
    // Fallback: parse from signature_data when fields_data is empty (fields mode)
    if (Object.keys(fd).length === 0 && req.signature_type === "fields" && req.signature_data) {
      try { fd = JSON.parse(req.signature_data as string); } catch { /* ignore */ }
    }
    // Fallback: if still empty, use signature_data directly as the signature image for all sig fields
    for (const [k, v] of Object.entries(fd)) {
      fieldValues[k] = v;
    }
    // If no field values at all but we have a signature image, apply to all sig/initials fields
    if (Object.keys(fieldValues).length === 0 && req.signature_data &&
        (req.signature_type === "draw" || req.signature_type === "type")) {
      for (const field of fields ?? []) {
        if (field.type === "signature" || field.type === "initials") {
          fieldValues[field.id] = req.signature_data as string;
        }
      }
    }
  }

  // Fetch original PDF bytes
  const pdfRes = await fetch(doc.file_url);
  if (!pdfRes.ok) return NextResponse.json({ error: "Failed to fetch original PDF" }, { status: 502 });
  const pdfBytes = await pdfRes.arrayBuffer();

  // Load with pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of fields ?? []) {
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageW, height: pageH } = page.getSize();

    const value = fieldValues[field.id];
    if (!value) continue;

    // Convert % coords to pdf-lib coords (origin bottom-left, y flipped)
    const x = (field.x / 100) * pageW;
    const fieldHeightPx = (field.height / 100) * pageH;
    const fieldWidthPx = (field.width / 100) * pageW;
    // pdf-lib y=0 is bottom; our y=0 is top
    const y = pageH - (field.y / 100) * pageH - fieldHeightPx;

    if ((field.type === "signature" || field.type === "initials") && value.startsWith("data:image/png;base64,")) {
      // Embed signature image
      const base64Data = value.replace("data:image/png;base64,", "");
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, {
        x,
        y: y + 2,
        width: fieldWidthPx,
        height: fieldHeightPx - 4,
        opacity: 1,
      });
    } else {
      // Text / date field
      const fontSize = Math.min(fieldHeightPx * 0.55, 12);
      page.drawText(String(value), {
        x: x + 2,
        y: y + (fieldHeightPx - fontSize) / 2,
        size: fontSize,
        font: helvetica,
        color: rgb(0.05, 0.1, 0.3),
        maxWidth: fieldWidthPx - 4,
      });
    }
  }

  // Add a signature summary page
  const summaryPage = pdfDoc.addPage();
  const { width: sw, height: sh } = summaryPage.getSize();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  summaryPage.drawText("Signing Certificate", { x: 50, y: sh - 60, size: 18, font: boldFont, color: rgb(0.2, 0.2, 0.8) });
  summaryPage.drawText(`Document: ${doc.name}`, { x: 50, y: sh - 90, size: 11, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  summaryPage.drawLine({ start: { x: 50, y: sh - 100 }, end: { x: sw - 50, y: sh - 100 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  let yPos = sh - 130;
  for (const req of requests ?? []) {
    summaryPage.drawText(`Signer: ${req.signer_name || req.signer_email}`, { x: 50, y: yPos, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    summaryPage.drawText(`Email: ${req.signer_email}`, { x: 50, y: yPos - 18, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    summaryPage.drawText(`Signed: ${req.signed_at ? new Date(req.signed_at).toLocaleString() : "—"}`, { x: 50, y: yPos - 34, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    yPos -= 60;
  }

  const signedPdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(signedPdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="signed-${doc.name}.pdf"`,
    },
  });
}
