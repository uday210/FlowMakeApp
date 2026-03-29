import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServerClient();

  // Fetch the signing request
  const { data: req, error: fetchError } = await supabase
    .from("esign_requests")
    .select("*")
    .eq("token", token)
    .single();

  if (fetchError || !req) {
    return NextResponse.json({ error: "Signing request not found" }, { status: 404 });
  }

  if (req.status === "signed") {
    return NextResponse.json({ error: "Document already signed" }, { status: 409 });
  }

  const body = await request.json();
  const { signature_data, signature_type, fields_data } = body as {
    signature_data: string;
    signature_type: "draw" | "type" | "fields";
    fields_data?: Record<string, string>;
  };

  if (!signature_data) {
    return NextResponse.json({ error: "Signature data is required" }, { status: 400 });
  }

  const signedAt = new Date().toISOString();

  // Update the request
  const { error: updateError } = await supabase
    .from("esign_requests")
    .update({
      status: "signed",
      signature_data,
      signature_type,
      signed_at: signedAt,
      fields_data: fields_data ?? {},
    })
    .eq("token", token);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If this request is linked to a workflow, trigger it
  if (req.workflow_id) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await fetch(`${baseUrl}/api/execute/${req.workflow_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _trigger: "esign",
          request_id: req.id,
          token: req.token,
          document_title: req.document_title,
          signer_email: req.signer_email,
          signer_name: req.signer_name,
          signature_type,
          signed_at: signedAt,
        }),
      });
    } catch {
      // Non-fatal — signing succeeded even if workflow trigger fails
    }
  }

  return NextResponse.json({ success: true, signed_at: signedAt });
}
