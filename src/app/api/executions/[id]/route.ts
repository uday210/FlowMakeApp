import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Join executions with workflows to filter by org_id
  const { data, error } = await ctx.admin
    .from("executions")
    .select("id, status, trigger_data, logs, started_at, finished_at, workflow_id, workflows!inner(org_id)")
    .eq("workflow_id", id)
    .eq("workflows.org_id", ctx.orgId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
