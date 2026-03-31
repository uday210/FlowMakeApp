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
    .select("id, token, document_id, document_title, document_content, signer_email, signer_name, signer_role, status, signed_at, created_at, signing_order")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch previous signers' field values so the sign page can show them as read-only overlays
  let previousSignatures: {
    signer_name: string;
    signer_email: string;
    signing_order: number;
    fields_data: Record<string, string>;
    signature_data: string | null;
    signature_type: string | null;
    signed_at: string;
  }[] = [];

  if (data.document_id && (data.signing_order ?? 1) > 1) {
    const { data: prevReqs } = await supabase
      .from("esign_requests")
      .select("signer_name, signer_email, signing_order, fields_data, signature_data, signature_type, signed_at")
      .eq("document_id", data.document_id)
      .eq("status", "signed")
      .lt("signing_order", data.signing_order ?? 1)
      .order("signing_order");

    previousSignatures = (prevReqs ?? []).map((r) => {
      let fd = (r.fields_data ?? {}) as Record<string, string>;
      if (Object.keys(fd).length === 0 && r.signature_type === "fields" && r.signature_data) {
        try { fd = JSON.parse(r.signature_data as string); } catch { /* ignore */ }
      }
      return { ...r, fields_data: fd };
    });
  }

  return NextResponse.json({ ...data, previous_signatures: previousSignatures });
}
