import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("esign_fields")
    .select("*")
    .eq("document_id", id)
    .order("page");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { fields } = await request.json() as { fields: Record<string, unknown>[] };

  // Replace all fields for this document
  await supabase.from("esign_fields").delete().eq("document_id", id);

  if (fields.length > 0) {
    const rows = fields.map((f) => ({ ...f, document_id: id }));
    const { error } = await supabase.from("esign_fields").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
