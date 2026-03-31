/**
 * GET /api/v1/esign/sessions/:session_id/download
 *
 * Downloads the fully signed PDF for a session.
 */

import { NextResponse } from "next/server";
import { getApiKeyContext } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiKeyContext(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: requests } = await admin
    .from("esign_requests")
    .select("*")
    .eq("session_id", sessionId)
    .eq("org_id", auth.orgId)
    .order("signing_order");

  if (!requests?.length) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const documentId = requests[0].document_id;
  const { data: doc } = await admin.from("esign_documents").select("*").eq("id", documentId).single();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: fields } = await admin.from("esign_fields").select("*").eq("document_id", documentId);

  // Build field values from signed requests
  const fieldValues: Record<string, string> = {};
  for (const r of requests.filter(r => r.status === "signed")) {
    const fd = (r.fields_data ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(fd)) fieldValues[k] = v;
  }

  const pdfRes = await fetch(doc.file_url);
  if (!pdfRes.ok) return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });

  const pdfDoc = await PDFDocument.load(await pdfRes.arrayBuffer());
  const pages = pdfDoc.getPages();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields ?? []) {
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pw, height: ph } = page.getSize();
    const value = fieldValues[field.id];
    if (!value) continue;
    const x = (field.x / 100) * pw;
    const fh = (field.height / 100) * ph;
    const fw = (field.width / 100) * pw;
    const y = ph - (field.y / 100) * ph - fh;
    if ((field.type === "signature" || field.type === "initials") && value.startsWith("data:image/png;base64,")) {
      const imgBytes = Uint8Array.from(atob(value.replace("data:image/png;base64,", "")), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, { x, y: y + 2, width: fw, height: fh - 4 });
    } else {
      const fs = Math.min(fh * 0.55, 12);
      page.drawText(String(value), { x: x + 2, y: y + (fh - fs) / 2, size: fs, font: helvetica, color: rgb(0.05, 0.1, 0.3), maxWidth: fw - 4 });
    }
  }

  // Certificate page
  const cert = pdfDoc.addPage();
  const { width: cw, height: ch } = cert.getSize();
  cert.drawText("Signing Certificate", { x: 50, y: ch - 60, size: 18, font: boldFont, color: rgb(0.2, 0.2, 0.8) });
  cert.drawText(`Document: ${doc.name}`, { x: 50, y: ch - 88, size: 11, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  cert.drawText(`Session: ${sessionId}`, { x: 50, y: ch - 106, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  cert.drawLine({ start: { x: 50, y: ch - 118 }, end: { x: cw - 50, y: ch - 118 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  let yp = ch - 148;
  for (const r of requests) {
    cert.drawText(`#${r.signing_order}  ${r.signer_name || r.signer_email}`, { x: 50, y: yp, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    cert.drawText(`Email: ${r.signer_email}`, { x: 50, y: yp - 16, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    cert.drawText(`Status: ${r.status}  |  ${r.signed_at ? new Date(r.signed_at).toLocaleString() : "—"}`, { x: 50, y: yp - 32, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    yp -= 58;
    if (yp < 80) break;
  }

  const bytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="signed-${doc.name}.pdf"`,
    },
  });
}
