import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Simple text extraction from PDF byte stream — works for text-based PDFs
// without any native dependencies. Finds BT/ET blocks and string operands.
function extractTextFromPdf(buffer: Buffer): string {
  const str = buffer.toString("latin1");
  const chunks: string[] = [];

  // Extract strings between BT (begin text) and ET (end text) markers
  const btEt = /BT[\s\S]*?ET/g;
  let block: RegExpExecArray | null;
  while ((block = btEt.exec(str)) !== null) {
    // Match PDF string literals: (text) and hex strings <hex>
    const strLit = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9A-Fa-f]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = strLit.exec(block[0])) !== null) {
      if (m[1] !== undefined) {
        // Decode common PDF escape sequences
        chunks.push(m[1].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\\\/g, "\\").replace(/\\(.)/g, "$1"));
      } else if (m[2]) {
        // Hex string — decode pairs of hex digits to chars
        const hex = m[2];
        let decoded = "";
        for (let i = 0; i < hex.length - 1; i += 2) {
          const code = parseInt(hex.slice(i, i + 2), 16);
          if (code > 31) decoded += String.fromCharCode(code);
        }
        if (decoded) chunks.push(decoded);
      }
    }
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("esign-documents")
    .upload(fileName, new Uint8Array(buffer), { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("esign-documents").getPublicUrl(fileName);

  // Extract text for AI assistant context (non-fatal)
  let extractedText = "";
  try {
    extractedText = extractTextFromPdf(buffer);
  } catch { /* silent */ }

  return NextResponse.json({ file_path: fileName, file_url: urlData.publicUrl, extracted_text: extractedText });
}
