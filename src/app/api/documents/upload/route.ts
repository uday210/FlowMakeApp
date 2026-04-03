import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { extractText } from "unpdf";

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
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    extractedText = Array.isArray(text) ? text.join(" ").trim() : (text ?? "").trim();
  } catch { /* silent — upload still succeeds without text */ }

  return NextResponse.json({ file_path: fileName, file_url: urlData.publicUrl, extracted_text: extractedText });
}
