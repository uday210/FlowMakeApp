import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect") ?? "/org";

  // Use configured app URL or derive from headers to avoid Railway internal localhost URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (request.headers.get("x-forwarded-host") ? `https://${request.headers.get("x-forwarded-host")}` : null)
    || url.origin;
  const redirect = (path: string) => NextResponse.redirect(new URL(path, appUrl));

  if (!code) {
    return redirect(redirectTo);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("[auth/callback] exchangeCodeForSession error:", error?.message);
      return redirect("/auth/login?error=auth_failed");
    }

    // Ensure profile exists
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, org_id")
      .eq("id", data.user.id)
      .single();

    const pendingOrgId = data.user.user_metadata?.pending_org_id as string | undefined;
    const pendingRole = (data.user.user_metadata?.pending_role as string | undefined) ?? "member";

    if (!profile) {
      // New user — create profile
      const insertData: Record<string, unknown> = {
        id: data.user.id,
        full_name: data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "",
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
      };
      // If invited to an org, assign them directly
      if (pendingOrgId) {
        insertData.org_id = pendingOrgId;
        insertData.role = pendingRole;
      }
      await adminClient.from("profiles").insert(insertData);
      return pendingOrgId ? redirect("/org") : redirect("/onboarding");
    }

    if (!profile.org_id) {
      // Existing profile without org — check for pending invite
      if (pendingOrgId) {
        await adminClient.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", data.user.id);
        return redirect("/org");
      }
      return redirect("/onboarding");
    }

    return redirect(redirectTo);
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return redirect("/auth/login?error=unexpected");
  }
}
