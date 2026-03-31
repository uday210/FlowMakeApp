import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await context.params;
    const ctx = await getOrgContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify workflow belongs to this org
    const { data: wf } = await ctx.admin.from("workflows").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
    if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await ctx.admin
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
