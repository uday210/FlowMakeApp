import { NextResponse } from "next/server";
import { getSuperAdminClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, org_id, created_at, orgs(name, is_active)")
    .order("created_at", { ascending: false });

  // Fetch emails from auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authUsers?.users ?? []) {
    emailMap[u.id] = u.email ?? "";
  }

  const result = (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap[p.id as string] ?? "",
    role: p.role,
    org_id: p.org_id,
    org_name: (p.orgs as { name?: string; is_active?: boolean } | null)?.name ?? null,
    org_active: (p.orgs as { name?: string; is_active?: boolean } | null)?.is_active ?? true,
    created_at: p.created_at,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const admin = await getSuperAdminClient();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, full_name, role, org_id } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "email and password are required" }, { status: 400 });

  // Create auth user with email already confirmed
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email },
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  // Upsert profile with role + org assignment
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: userId,
      full_name: full_name || email,
      role: role || "member",
      org_id: org_id || null,
    });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ id: userId, email, full_name: full_name || email, role: role || "member", org_id: org_id || null }, { status: 201 });
}
