import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect") ?? "/org";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get("x-forwarded-host")
      ? `https://${request.headers.get("x-forwarded-host")}`
      : url.origin);

  const makeRedirect = (path: string) =>
    NextResponse.redirect(new URL(path, appUrl));

  if (!code) return makeRedirect(redirectTo);

  // Build a redirect response so we can attach Set-Cookie headers
  let response = makeRedirect(redirectTo);

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Re-create the response so each Set-Cookie gets attached
          response = makeRedirect(redirectTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.user) {
      console.error("[auth/callback] exchangeCodeForSession:", error?.message);
      return makeRedirect("/auth/login?error=auth_failed");
    }

    // Upsert profile
    try {
      const admin = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
      );

      const { data: profile } = await admin
        .from("profiles")
        .select("id, org_id")
        .eq("id", data.user.id)
        .single();

      const pendingOrgId = data.user.user_metadata?.pending_org_id as string | undefined;
      const pendingRole = (data.user.user_metadata?.pending_role as string | undefined) ?? "member";

      if (!profile) {
        const insertData: Record<string, unknown> = {
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "",
          avatar_url: data.user.user_metadata?.avatar_url ?? null,
        };
        if (pendingOrgId) {
          insertData.org_id = pendingOrgId;
          insertData.role = pendingRole;
        }
        await admin.from("profiles").insert(insertData);
        const dest = pendingOrgId ? "/org" : "/onboarding";
        const r = makeRedirect(dest);
        // Copy session cookies onto the new redirect response
        response.cookies.getAll().forEach(({ name, value, ...rest }) =>
          r.cookies.set(name, value, rest as Parameters<typeof r.cookies.set>[2])
        );
        return r;
      }

      if (!profile.org_id) {
        if (pendingOrgId) {
          await admin.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", data.user.id);
          const r = makeRedirect("/org");
          response.cookies.getAll().forEach(({ name, value, ...rest }) =>
            r.cookies.set(name, value, rest as Parameters<typeof r.cookies.set>[2])
          );
          return r;
        }
        const r = makeRedirect("/onboarding");
        response.cookies.getAll().forEach(({ name, value, ...rest }) =>
          r.cookies.set(name, value, rest as Parameters<typeof r.cookies.set>[2])
        );
        return r;
      }
    } catch (profileErr) {
      console.error("[auth/callback] profile upsert error:", profileErr);
      // Don't block login if profile upsert fails — just redirect to org
    }

    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return makeRedirect("/auth/login?error=unexpected");
  }
}
