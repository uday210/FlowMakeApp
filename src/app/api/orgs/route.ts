import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])),
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug } = await req.json();
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);

  // Check slug uniqueness
  const { data: existing } = await admin.from("orgs").select("id").eq("slug", slug).single();
  if (existing) return NextResponse.json({ error: "That slug is already taken" }, { status: 409 });

  // Create org
  const { data: org, error: orgError } = await admin
    .from("orgs")
    .insert({ name: name.trim(), slug })
    .select("id")
    .single();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  // Update profile with org_id
  const { error: profileError } = await admin
    .from("profiles")
    .update({ org_id: org.id, role: "owner" })
    .eq("id", user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ org });
}
