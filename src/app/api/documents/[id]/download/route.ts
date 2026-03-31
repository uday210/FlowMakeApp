import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  // Optional: limit to signatures up to a specific signing_order
  const url = new URL(req.url);
  const untilOrder = url.searchParams.get("until_order");
  const maxOrder = untilOrder ? parseInt(untilOrder, 10) : Infinity;

  const { data: doc, error: docError } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: fields } = await supabase
    .from("esign_fields")
    .select("*")
    .eq("document_id", id);

  // Fetch signed requests up to maxOrder
  let query = supabase
    .from("esign_requests")
    .select("*")
    .eq("document_id", id)
    .eq("status", "signed")
    .order("signing_order");

  const { data: allRequests } = await query;
  const requests = (allRequests ?? []).filter(
    (r) => (r.signing_order ?? 1) <= maxOrder
  );

  // Build field_id → value map from included signers only
  const fieldValues: Record<string, string> = {};
  for (const r of requests) {
    let fd = (r.fields_data ?? {}) as Record<string, string>;
    if (Object.keys(fd).length === 0 && r.signature_type === "fields" && r.signature_data) {
      try { fd = JSON.parse(r.signature_data as string); } catch { /* ignore */ }
    }
    for (const [k, v] of Object.entries(fd)) {
      fieldValues[k] = v;
    }
    if (Object.keys(fieldValues).length === 0 && r.signature_data &&
        (r.signature_type === "draw" || r.signature_type === "type")) {
      for (const field of fields ?? []) {
        if (field.type === "signature" || field.type === "initials") {
          if (!r.signer_email || field.signer_email === r.signer_email || !field.signer_email) {
            fieldValues[field.id] = r.signature_data as string;
          }
        }
      }
    }
  }

  const pdfRes = await fetch(doc.file_url);
  if (!pdfRes.ok) return NextResponse.json({ error: "Failed to fetch original PDF" }, { status: 502 });
  const pdfBytes = await pdfRes.arrayBuffer();

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

    const x = (field.x / 100) * pageW;
    const fieldHeightPx = (field.height / 100) * pageH;
    const fieldWidthPx = (field.width / 100) * pageW;
    const y = pageH - (field.y / 100) * pageH - fieldHeightPx;

    if ((field.type === "signature" || field.type === "initials") && value.startsWith("data:image/png;base64,")) {
      const base64Data = value.replace("data:image/png;base64,", "");
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, { x, y: y + 2, width: fieldWidthPx, height: fieldHeightPx - 4, opacity: 1 });
    } else {
      const fontSize = Math.min(fieldHeightPx * 0.55, 12);
      page.drawText(String(value), {
        x: x + 2, y: y + (fieldHeightPx - fontSize) / 2,
        size: fontSize, font: helvetica, color: rgb(0.05, 0.1, 0.3), maxWidth: fieldWidthPx - 4,
      });
    }
  }

  // Signing certificate page
  const summaryPage = pdfDoc.addPage();
  const { width: sw, height: sh } = summaryPage.getSize();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  summaryPage.drawText("Signing Certificate", { x: 50, y: sh - 60, size: 18, font: boldFont, color: rgb(0.2, 0.2, 0.8) });
  summaryPage.drawText(`Document: ${doc.name}`, { x: 50, y: sh - 90, size: 11, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  if (isFinite(maxOrder)) {
    summaryPage.drawText(`Signatures included: Signers 1 – ${maxOrder}`, { x: 50, y: sh - 108, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  }
  summaryPage.drawLine({ start: { x: 50, y: sh - 118 }, end: { x: sw - 50, y: sh - 118 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  let yPos = sh - 148;
  for (const r of requests) {
    summaryPage.drawText(`#${r.signing_order ?? 1}  ${r.signer_name || r.signer_email}`, { x: 50, y: yPos, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    summaryPage.drawText(`Email: ${r.signer_email}`, { x: 50, y: yPos - 18, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    summaryPage.drawText(`Signed: ${r.signed_at ? new Date(r.signed_at).toLocaleString() : "—"}`, { x: 50, y: yPos - 34, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    yPos -= 64;
    if (yPos < 80) break;
  }

  const signedPdfBytes = await pdfDoc.save();
  const filename = isFinite(maxOrder)
    ? `signed-by-${maxOrder}-${doc.name}.pdf`
    : `signed-${doc.name}.pdf`;

  return new NextResponse(Buffer.from(signedPdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
