import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";

export async function POST(request: Request) {
  try {
    const { userId, userMeta } = await request.json();
    if (!userId) return NextResponse.json({ ok: false });

    const admin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("id, org_id")
      .eq("id", userId)
      .single();

    const pendingOrgId = userMeta?.pending_org_id as string | undefined;
    const pendingRole = (userMeta?.pending_role as string | undefined) ?? "member";

    if (!profile) {
      const row: Record<string, unknown> = {
        id: userId,
        full_name: userMeta?.full_name ?? userMeta?.email?.split("@")[0] ?? "",
        avatar_url: userMeta?.avatar_url ?? null,
      };
      if (pendingOrgId) { row.org_id = pendingOrgId; row.role = pendingRole; }
      await admin.from("profiles").insert(row);
      return NextResponse.json({ ok: true, redirect: pendingOrgId ? "/org" : "/onboarding" });
    }

    if (!profile.org_id && pendingOrgId) {
      await admin.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", userId);
      return NextResponse.json({ ok: true, redirect: "/org" });
    }

    if (!profile.org_id) {
      return NextResponse.json({ ok: true, redirect: "/onboarding" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ensure-profile]", err);
    return NextResponse.json({ ok: false });
  }
}
