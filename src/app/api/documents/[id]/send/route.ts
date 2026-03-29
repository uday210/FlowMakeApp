import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const { signers } = await request.json() as {
    signers: { email: string; name: string }[];
  };

  if (!signers || signers.length === 0) {
    return NextResponse.json({ error: "At least one signer is required" }, { status: 400 });
  }

  // Fetch the document
  const { data: doc, error: docError } = await supabase
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Create a signing request for each signer
  const requests = [];
  for (const signer of signers) {
    const { data: req, error } = await supabase
      .from("esign_requests")
      .insert({
        document_id: id,
        document_title: doc.name,
        document_content: "",
        signer_email: signer.email,
        signer_name: signer.name,
        status: "pending",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    requests.push(req);
  }

  // Mark document as sent
  await supabase.from("esign_documents").update({ status: "sent" }).eq("id", id);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      signer_email: r.signer_email,
      signing_url: `${baseUrl}/sign/${r.token}`,
    })),
  });
}
