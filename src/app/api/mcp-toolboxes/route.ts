import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.admin
    .from("mcp_toolboxes")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, url, auth_key, auth_header_name, description, type, slug, transport } = body;
  const serverType: string = type ?? "external";

  if (serverType === "external" && !url) return NextResponse.json({ error: "url required for external servers" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // For hosted servers, generate a slug if not provided
  let finalSlug: string | null = null;
  if (serverType === "hosted") {
    finalSlug = slug?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const { data, error } = await ctx.admin
    .from("mcp_toolboxes")
    .insert({
      name,
      url: serverType === "external" ? url : null,
      auth_key: auth_key ?? null,
      auth_header_name: auth_header_name ?? null,
      description: description ?? null,
      org_id: ctx.orgId,
      type: serverType,
      slug: finalSlug,
      transport: transport ?? "sse",
      status: serverType === "hosted" ? "active" : "unknown",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "mcp_toolbox.created",
    resourceType: "mcp_toolbox",
    resourceId: String(data.id),
    meta: { name },
  });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await ctx.admin
    .from("mcp_toolboxes")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    supabase: ctx.admin,
    orgId: ctx.orgId,
    action: "mcp_toolbox.deleted",
    resourceType: "mcp_toolbox",
    resourceId: id,
  });
  return NextResponse.json({ ok: true });
}
