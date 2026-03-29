// NOTE: Requires migration to create the workflow_versions table:
// CREATE TABLE workflow_versions (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
//   version_number integer NOT NULL,
//   snapshot jsonb NOT NULL,
//   created_at timestamptz NOT NULL DEFAULT now(),
//   UNIQUE (workflow_id, version_number)
// );

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("workflow_versions")
      .select("id, workflow_id, version_number, created_at")
      .eq("workflow_id", id)
      .order("version_number", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { nodes, edges, name } = body as {
      nodes: unknown;
      edges: unknown;
      name?: string;
    };

    const supabase = createServerClient();

    // Get the current max version_number for this workflow
    const { data: existing } = await supabase
      .from("workflow_versions")
      .select("version_number")
      .eq("workflow_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = existing ? (existing.version_number as number) + 1 : 1;

    const { data, error } = await supabase
      .from("workflow_versions")
      .insert({
        workflow_id: id,
        version_number: nextVersion,
        snapshot: { nodes, edges, name },
      })
      .select("id, workflow_id, version_number, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save version" },
      { status: 500 }
    );
  }
}
