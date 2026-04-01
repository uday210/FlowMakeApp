import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect") ?? "/org";

  if (code) {
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

    if (!error && data.user) {
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
        return pendingOrgId
          ? NextResponse.redirect(new URL("/org", request.url))
          : NextResponse.redirect(new URL("/onboarding", request.url));
      }

      if (!profile.org_id) {
        // Existing profile without org — check for pending invite
        if (pendingOrgId) {
          await adminClient.from("profiles").update({ org_id: pendingOrgId, role: pendingRole }).eq("id", data.user.id);
          return NextResponse.redirect(new URL("/org", request.url));
        }
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
