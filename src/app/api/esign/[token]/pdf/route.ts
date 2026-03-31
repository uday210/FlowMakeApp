import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Use service role key — anon key is blocked by RLS on esign_documents (no public policies)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
