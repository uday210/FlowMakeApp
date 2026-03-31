import { NextResponse } from "next/server";
import { getOrgContext, getBaseUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { signers } = await request.json() as {
    signers: { email: string; name: string; order?: number }[];
  };

  if (!signers || signers.length === 0) {
    return NextResponse.json({ error: "At least one signer is required" }, { status: 400 });
  }

  const { data: doc, error: docError } = await ctx.admin
    .from("esign_documents")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Assign order: use provided order or auto-assign 1, 2, 3...
  const ordered = signers.map((s, i) => ({ ...s, signing_order: s.order ?? i + 1 }));
  ordered.sort((a, b) => a.signing_order - b.signing_order);

  const isSequential = ordered.length > 1;

  const requests = [];
  for (const signer of ordered) {
    // First signer is immediately 'pending', rest 'waiting' (sequential mode)
    const status = (!isSequential || signer.signing_order === 1) ? "pending" : "waiting";

    const { data: req, error } = await ctx.admin
      .from("esign_requests")
      .insert({
        document_id: id,
        document_title: doc.name,
        document_content: "",
        signer_email: signer.email,
        signer_name: signer.name,
        status,
        signing_order: signer.signing_order,
        org_id: ctx.orgId,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    requests.push(req);
  }

  await ctx.admin.from("esign_documents").update({ status: "sent" }).eq("id", id).eq("org_id", ctx.orgId);

  const baseUrl = getBaseUrl(request);
  return NextResponse.json({
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      signer_email: r.signer_email,
      signing_order: r.signing_order,
      status: r.status,
      signing_url: r.status === "pending" ? `${baseUrl}/sign/${r.token}` : null,
    })),
  });
}
