import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();

  const [{ data: doc }, { data: requests }, { data: fields }] = await Promise.all([
    supabase.from("esign_documents").select("*").eq("id", id).single(),
    supabase.from("esign_requests").select("*").eq("document_id", id).order("created_at"),
    supabase.from("esign_fields").select("*").eq("document_id", id).order("page"),
  ]);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signed = (requests ?? []).filter((r) => r.status === "signed").length;
  const total = (requests ?? []).length;

  // Auto-complete document if all signed
  if (total > 0 && signed === total && doc.status !== "completed") {
    await supabase.from("esign_documents").update({ status: "completed" }).eq("id", id);
    doc.status = "completed";
  }

  return NextResponse.json({ document: doc, requests: requests ?? [], fields: fields ?? [], signed, total });
}
