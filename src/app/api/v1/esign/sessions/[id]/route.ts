/**
 * GET /api/v1/esign/sessions/:session_id
 *
 * Returns full status of a signing session — all signers, their statuses, signing URLs.
 */

import { NextResponse } from "next/server";
import { getApiKeyContext } from "@/lib/apiAuth";
import { getBaseUrl } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getApiKeyContext(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;
  const baseUrl = getBaseUrl(request);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: requests, error } = await admin
    .from("esign_requests")
    .select("id, token, signer_email, signer_name, signer_role, status, signing_order, signed_at, metadata, document_id")
    .eq("session_id", sessionId)
    .eq("org_id", auth.orgId)
    .order("signing_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!requests?.length) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const signed = requests.filter(r => r.status === "signed").length;
  const total = requests.length;
  const allSigned = signed === total;
  const documentId = requests[0].document_id;

  return NextResponse.json({
    session_id: sessionId,
    document_id: documentId,
    status: allSigned ? "completed" : signed > 0 ? "in_progress" : "pending",
    progress: { signed, total },
    download_url: allSigned ? `${baseUrl}/api/v1/esign/sessions/${sessionId}/download` : null,
    signers: requests.map(r => ({
      id: r.id,
      email: r.signer_email,
      name: r.signer_name,
      role: r.signer_role,
      order: r.signing_order,
      status: r.status,
      signed_at: r.signed_at,
      signing_url: r.status === "pending" ? `${baseUrl}/sign/${r.token}` : null,
      metadata: r.metadata,
    })),
  });
}
