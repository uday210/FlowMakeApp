import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/org/members/[id] — update role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "admin" && ctx.role !== "superadmin") {
    return NextResponse.json({ error: "Only org admins can update members" }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();
  const allowedRoles = ["member", "admin"];
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const { error } = await ctx.admin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/org/members/[id] — remove member from org
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "admin" && ctx.role !== "superadmin") {
    return NextResponse.json({ error: "Only org admins can remove members" }, { status: 403 });
  }

  const { id } = await params;

  // Cannot remove yourself
  if (id === ctx.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself from the org" }, { status: 400 });
  }

  const { error } = await ctx.admin
    .from("profiles")
    .update({ org_id: null, role: "member" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
