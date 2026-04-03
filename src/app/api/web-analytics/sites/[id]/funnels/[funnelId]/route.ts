import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; funnelId: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, funnelId } = await params;

  const { data: site } = await ctx.admin.from("web_analytics_sites").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await ctx.admin.from("web_analytics_funnels").delete().eq("id", funnelId).eq("site_id", id);
  return NextResponse.json({ ok: true });
}
