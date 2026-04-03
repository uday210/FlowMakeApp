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
    .select("id, token, document_id, document_title, document_content, signer_email, signer_name, signer_role, status, signed_at, created_at, signing_order, session_id, esign_documents(file_url, ai_enabled, ai_disclaimer)")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Flatten the joined file_url so callers don't need an authenticated /api/documents fetch
  const esignDoc = data.esign_documents as { file_url?: string; ai_enabled?: boolean; ai_disclaimer?: string } | null;
  const fileUrl = esignDoc?.file_url ?? null;
  const aiEnabled = esignDoc?.ai_enabled ?? false;
  const aiDisclaimer = esignDoc?.ai_disclaimer ?? "";

  // Fetch fields for the document so the signing page doesn't need an authenticated call
  let documentFields: unknown[] = [];
  if (data.document_id) {
    const { data: fields } = await supabase
      .from("esign_fields")
      .select("*")
      .eq("document_id", data.document_id)
      .order("page");
    documentFields = fields ?? [];
  }

  // Fetch previous signers' field values so the sign page can show them as read-only overlays
  let previousSignatures: {
    signer_name: string;
    signer_email: string;
    signer_role: string | null;
    signing_order: number;
    fields_data: Record<string, string>;
    signature_data: string | null;
    signature_type: string | null;
    signed_at: string;
  }[] = [];

  if (data.document_id && (data.signing_order ?? 1) > 1) {
    // Scope to this session so other sessions on the same document don't bleed in
    let prevQuery = supabase
      .from("esign_requests")
      .select("signer_name, signer_email, signer_role, signing_order, fields_data, signature_data, signature_type, signed_at")
      .eq("status", "signed")
      .lt("signing_order", data.signing_order ?? 1)
      .order("signing_order");

    if (data.session_id) {
      prevQuery = prevQuery.eq("session_id", data.session_id);
    } else {
      prevQuery = prevQuery.eq("document_id", data.document_id);
    }

    const { data: prevReqs } = await prevQuery;

    previousSignatures = (prevReqs ?? []).map((r) => {
      let fd = (r.fields_data ?? {}) as Record<string, string>;
      if (Object.keys(fd).length === 0 && r.signature_type === "fields" && r.signature_data) {
        try { fd = JSON.parse(r.signature_data as string); } catch { /* ignore */ }
      }
      return { ...r, fields_data: fd };
    });
  }

  const { esign_documents: _doc, ...rest } = data as typeof data & { esign_documents: unknown };
  return NextResponse.json({ ...rest, file_url: fileUrl, ai_enabled: aiEnabled, ai_disclaimer: aiDisclaimer, document_fields: documentFields, previous_signatures: previousSignatures });
}
