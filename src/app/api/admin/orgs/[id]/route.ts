import { NextResponse } from "next/server";
import { getSuperAdminClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [{ data: org }, { data: members }, { data: workflows }] = await Promise.all([
    admin.from("orgs").select("*").eq("id", id).single(),
    admin.from("profiles").select("id, full_name, role, created_at").eq("org_id", id).order("created_at"),
    admin.from("workflows").select("id, name, is_active, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({ org, members: members ?? [], workflows: workflows ?? [] });
}

export async function PATCH(req: Request, { params }: Params) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.plan !== undefined) updates.plan = body.plan;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await admin
    .from("orgs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await Promise.all([
    admin.from("workflows").delete().eq("org_id", id),
    admin.from("chatbots").delete().eq("org_id", id),
    admin.from("user_tables").delete().eq("org_id", id),
    admin.from("connections").delete().eq("org_id", id),
    admin.from("workflow_secrets").delete().eq("org_id", id),
    admin.from("workflow_data").delete().eq("org_id", id),
    admin.from("mcp_toolboxes").delete().eq("org_id", id),
  ]);

  await admin.from("profiles").update({ org_id: null }).eq("org_id", id);

  const { error } = await admin.from("orgs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
