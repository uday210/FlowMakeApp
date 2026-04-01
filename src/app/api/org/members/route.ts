import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/org/members — list all members in the caller's org
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profiles, error } = await ctx.admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with email from auth.users
  const members = await Promise.all(
    (profiles ?? []).map(async (p) => {
      try {
        const { data: { user } } = await ctx.admin.auth.admin.getUserById(p.id);
        return { ...p, email: user?.email ?? "" };
      } catch {
        return { ...p, email: "" };
      }
    })
  );

  return NextResponse.json(members);
}

// POST /api/org/members — invite a new user by email
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can invite
  if (ctx.role !== "admin" && ctx.role !== "superadmin") {
    return NextResponse.json({ error: "Only org admins can invite members" }, { status: 403 });
  }

  const { email, role = "member" } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const allowedRoles = ["member", "admin"];
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  // Check if user already exists in Supabase
  const { data: { users } } = await ctx.admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    // Check if they're already in another org
    const { data: existingProfile } = await ctx.admin
      .from("profiles")
      .select("org_id")
      .eq("id", existing.id)
      .single();

    if (existingProfile?.org_id && existingProfile.org_id !== ctx.orgId) {
      return NextResponse.json({ error: "This user already belongs to another organization" }, { status: 409 });
    }

    // Add to this org
    await ctx.admin
      .from("profiles")
      .upsert({ id: existing.id, org_id: ctx.orgId, role }, { onConflict: "id" });

    return NextResponse.json({ status: "added", email: existing.email });
  }

  // New user — send invite email via Supabase
  const { data, error } = await ctx.admin.auth.admin.inviteUserByEmail(email, {
    data: { pending_org_id: ctx.orgId, pending_role: role },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "invited", email: data.user?.email });
}
