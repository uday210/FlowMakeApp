import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const go = (path: string) => NextResponse.redirect(`${appUrl}${path}`);

  if (!code) return go("/org");

  // We need a mutable redirect response to attach session cookies to
  let response = go("/org");

  try {
    // Use @supabase/ssr so it can read the PKCE code_verifier from cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          response = go("/org");
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.user) {
      console.error("[auth/callback] exchange error:", error?.message ?? "no user");
      return go("/auth/login?error=auth_failed");
    }

    // Upsert profile (best-effort)
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const admin = createClient(supabaseUrl, serviceKey ?? supabaseAnonKey);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, org_id")
        .eq("id", data.user.id)
        .single();

      const pendingOrgId = data.user.user_metadata?.pending_org_id as string | undefined;
      const pendingRole = (data.user.user_metadata?.pending_role as string | undefined) ?? "member";

      if (!profile) {
        const row: Record<string, unknown> = {
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "",
          avatar_url: data.user.user_metadata?.avatar_url ?? null,
        };
        if (pendingOrgId) { row.org_id = pendingOrgId; row.role = pendingRole; }
        await admin.from("profiles").insert(row);

        const dest = pendingOrgId ? "/org" : "/onboarding";
        const r = go(dest);
        response.cookies.getAll().forEach(c => r.cookies.set(c.name, c.value));
        return r;
      }

      if (!profile.org_id) {
        if (pendingOrgId) {
          await admin.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", data.user.id);
          const r = go("/org");
          response.cookies.getAll().forEach(c => r.cookies.set(c.name, c.value));
          return r;
        }
        const r = go("/onboarding");
        response.cookies.getAll().forEach(c => r.cookies.set(c.name, c.value));
        return r;
      }
    } catch (profileErr) {
      console.error("[auth/callback] profile error:", profileErr);
    }

    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return go("/auth/login?error=unexpected");
  }
}
