import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const go = (path: string) => NextResponse.redirect(`${appUrl}${path}`);

  if (!code) return go("/org");

  try {
    // Use a plain supabase-js client — no cookie handling needed here.
    // Supabase will set the session via the access_token in the URL hash on the client side.
    // On the server we just need to exchange the code for tokens and set them as cookies manually.
    const { data, error } = await createClient(supabaseUrl, supabaseAnonKey).auth.exchangeCodeForSession(code);

    if (error || !data?.user) {
      console.error("[auth/callback] exchange error:", error?.message ?? "no user");
      return go("/auth/login?error=auth_failed");
    }

    // Upsert profile (best-effort — don't block login if this fails)
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
        return go(pendingOrgId ? "/org" : "/onboarding");
      }

      if (!profile.org_id) {
        if (pendingOrgId) {
          await admin.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", data.user.id);
          return go("/org");
        }
        return go("/onboarding");
      }
    } catch (profileErr) {
      console.error("[auth/callback] profile error:", profileErr);
    }

    // Build response with session cookies
    const response = go("/org");

    // Set access token and refresh token as cookies so SSR auth works
    const maxAge = data.session?.expires_in ?? 3600;
    response.cookies.set("sb-access-token", data.session?.access_token ?? "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    response.cookies.set("sb-refresh-token", data.session?.refresh_token ?? "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return go("/auth/login?error=unexpected");
  }
}
