import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Simple text extraction from PDF byte stream — works for text-based PDFs
function extractTextFromPdf(buffer: Buffer): string {
  try {
    const str = buffer.toString("latin1");
    const chunks: string[] = [];

    // Find all literal strings inside parentheses — simplest reliable approach
    // Skips BT/ET parsing entirely to avoid regex catastrophic backtracking
    const re = /\(([^)]{1,500})\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
      try {
        // Replace only safe escape sequences, drop anything unusual
        const text = m[1]
          .replace(/\\n/g, " ")
          .replace(/\\r/g, " ")
          .replace(/\\t/g, " ")
          .replace(/\\\\/g, "\\")
          .replace(/\\[^\\nrt]/g, "") // drop unknown escapes
          .replace(/[^\x20-\x7E]/g, ""); // keep only printable ASCII
        if (text.trim().length > 1) chunks.push(text.trim());
      } catch { /* skip malformed string */ }
    }

    return chunks.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
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
