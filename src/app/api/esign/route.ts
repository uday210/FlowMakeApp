import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("esign_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("esign_requests")
    .insert({
      workflow_id: body.workflow_id || null,
      document_title: body.document_title || "",
      document_content: body.document_content || "",
      signer_email: body.signer_email || "",
      signer_name: body.signer_name || "",
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({ ...data, signing_url: `${baseUrl}/sign/${data.token}` }, { status: 201 });
}
