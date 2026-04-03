import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store") ?? "default";

  const { data, error } = await ctx.admin
    .from("workflow_data")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("store", store)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { store = "default", key, value } = body;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("workflow_data")
    .upsert(
      { org_id: ctx.orgId, store, key, value: String(value ?? ""), updated_at: new Date().toISOString() },
      { onConflict: "org_id,store,key" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "datastore.set",
    resourceType: "datastore",
    resourceId: String(data.id),
    meta: { key: body.key },
  });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store") ?? "default";
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const { error } = await ctx.admin
    .from("workflow_data")
    .delete()
    .eq("org_id", ctx.orgId)
    .eq("store", store)
    .eq("key", key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "datastore.deleted",
    resourceType: "datastore",
    meta: { key },
  });
  return NextResponse.json({ ok: true });
}
