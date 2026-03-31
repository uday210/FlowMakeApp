import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Call this at the top of any API route that needs auth + org context.
 * Returns null if the user is not authenticated or has no org.
 */
export async function getOrgContext() {
  const cookieStore = await cookies();

  const authClient = createSSRClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;

  const admin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return null;

  return {
    user,
    orgId: profile.org_id as string,
    role: profile.role as string,
    admin,
  };
}

/**
 * Checks if the current request is from a superadmin.
 * Superadmins have role = 'superadmin' in the profiles table.
 * They don't need an org and control the whole platform.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();

  const authClient = createSSRClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return false;

  const admin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "superadmin";
}

/**
 * Derives the public base URL from the incoming request headers so signing
 * links work correctly behind Railway / any reverse proxy.
 * Prefers NEXT_PUBLIC_APP_URL env var when explicitly set.
 */
export function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Returns the service-role admin client for superadmin API routes.
 * Returns null if the user is not a superadmin.
 */
export async function getSuperAdminClient() {
  const ok = await isSuperAdmin();
  if (!ok) return null;
  return createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey);
}
