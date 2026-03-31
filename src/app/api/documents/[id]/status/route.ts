import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const [{ data: doc }, { data: requests }, { data: fields }] = await Promise.all([
    supabase.from("esign_documents").select("*").eq("id", id).single(),
    supabase.from("esign_requests").select("*").eq("document_id", id).order("signing_order"),
    supabase.from("esign_fields").select("*").eq("document_id", id).order("page"),
  ]);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signed = (requests ?? []).filter((r) => r.status === "signed").length;
  const total = (requests ?? []).length;

  // Auto-complete document when all signers have signed
  if (total > 0 && signed === total && doc.status !== "completed") {
    await supabase.from("esign_documents").update({ status: "completed" }).eq("id", id);
    doc.status = "completed";
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const requestsWithLinks = (requests ?? []).map((r) => ({
    ...r,
    signing_url: r.token
      ? (r.status === "pending" ? `${baseUrl}/sign/${r.token}` : null)
      : null,
  }));

  return NextResponse.json({ document: doc, requests: requestsWithLinks, fields: fields ?? [], signed, total });
}
