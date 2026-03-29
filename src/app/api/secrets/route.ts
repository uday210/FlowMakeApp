// NOTE: Requires migration to create the workflow_secrets table:
// CREATE TABLE workflow_secrets (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   name text NOT NULL UNIQUE,
//   value text NOT NULL,
//   created_at timestamptz NOT NULL DEFAULT now()
// );

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("workflow_secrets")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch secrets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, value } = await req.json();
    if (!name || !value) {
      return NextResponse.json({ error: "name and value are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("workflow_secrets")
      .upsert({ name, value }, { onConflict: "name" })
      .select("id, name, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save secret" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("workflow_secrets")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete secret" },
      { status: 500 }
    );
  }
}
