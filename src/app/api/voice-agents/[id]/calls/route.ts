import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify agent belongs to org
  const { data: agent } = await ctx.admin
    .from("voice_agents")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const { data, error, count } = await ctx.admin
    .from("voice_calls")
    .select("*", { count: "exact" })
    .eq("agent_id", id)
    .eq("org_id", ctx.orgId)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ calls: data ?? [], total: count ?? 0 });
}
