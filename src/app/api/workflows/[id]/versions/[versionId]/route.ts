import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await context.params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("workflow_versions")
      .select("id, workflow_id, version_number, snapshot, created_at")
      .eq("workflow_id", id)
      .eq("id", versionId)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch version" },
      { status: 500 }
    );
  }
}
