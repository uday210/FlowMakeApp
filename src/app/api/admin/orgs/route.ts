import { NextResponse } from "next/server";
import { getSuperAdminClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: orgs } = await admin
    .from("orgs")
    .select("id, name, slug, plan, is_active, created_at, timezone")
    .order("created_at", { ascending: false });

  const enriched = await Promise.all((orgs ?? []).map(async (org) => {
    const [{ count: member_count }, { count: workflow_count }, { count: agent_count }, { count: table_count }] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("org_id", org.id),
      admin.from("workflows").select("*", { count: "exact", head: true }).eq("org_id", org.id),
      admin.from("chatbots").select("*", { count: "exact", head: true }).eq("org_id", org.id),
      admin.from("user_tables").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    ]);
    return { ...org, member_count: member_count ?? 0, workflow_count: workflow_count ?? 0, agent_count: agent_count ?? 0, table_count: table_count ?? 0 };
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, plan } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const { data, error } = await admin
    .from("orgs")
    .insert({ name: name.trim(), slug, plan: plan || "free", is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, member_count: 0, workflow_count: 0, agent_count: 0, table_count: 0 }, { status: 201 });
}
