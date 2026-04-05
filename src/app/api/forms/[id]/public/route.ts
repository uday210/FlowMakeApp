import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: form, error } = await admin
    .from("forms")
    .select("id, name, description, questions, settings, is_published")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json(form);
}
