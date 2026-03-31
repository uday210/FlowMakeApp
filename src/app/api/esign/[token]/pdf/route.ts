import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("esign_requests")
    .select("document_id, esign_documents(file_url)")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileUrl = (data.esign_documents as { file_url?: string } | null)?.file_url;
  if (!fileUrl) return NextResponse.json({ error: "No file" }, { status: 404 });

  const res = await fetch(fileUrl);
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=300",
    },
  });
}
