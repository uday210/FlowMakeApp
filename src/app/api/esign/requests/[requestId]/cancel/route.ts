import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await params;

  // Verify the request belongs to a document owned by this org
  const { data: req } = await ctx.admin
    .from("esign_requests")
    .select("id, status, document_id")
    .eq("id", requestId)
    .single();

  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "pending") return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });

  // Verify org ownership via document
  const { data: doc } = await ctx.admin
    .from("esign_documents")
    .select("id")
    .eq("id", req.document_id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!doc) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  await ctx.admin
    .from("esign_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  return NextResponse.json({ ok: true });
}
