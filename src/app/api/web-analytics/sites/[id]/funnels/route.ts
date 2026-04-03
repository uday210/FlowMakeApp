import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: site } = await ctx.admin.from("web_analytics_sites").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.admin
    .from("web_analytics_funnels")
    .select("id, name, steps, created_at")
    .eq("site_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: site } = await ctx.admin.from("web_analytics_sites").select("id").eq("id", id).eq("org_id", ctx.orgId).single();
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, steps } = await req.json();
  if (!name || !Array.isArray(steps) || steps.length < 2) {
    return NextResponse.json({ error: "Need a name and at least 2 steps" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("web_analytics_funnels")
    .insert({ site_id: id, name, steps })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
