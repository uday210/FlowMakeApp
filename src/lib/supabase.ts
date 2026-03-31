import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient as createSSRServerClient } from "@supabase/ssr";
import type { Workflow, Execution } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// ── Browser client — handles auth sessions via cookies ────────────────────────
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// ── Server client using service role key (for API routes — bypasses RLS) ──────
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey);
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

// ── SSR auth client — reads cookies in Server Components / middleware ──────────
export function createAuthServerClient(cookieStore: {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}) {
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}

export type { Workflow, Execution };
