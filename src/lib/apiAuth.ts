import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Validates an API key from the Authorization header.
 * Accepts: "Bearer sk_live_xxxx"
 * Returns orgId if valid, null otherwise.
 */
export async function getApiKeyContext(request: Request): Promise<{ orgId: string; keyId: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;

  const rawKey = auth.slice(7).trim();
  if (!rawKey.startsWith("sk_")) return null;

  const keyHash = await hashKey(rawKey);
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: key } = await admin
    .from("api_keys")
    .select("id, org_id, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (!key || !key.is_active) return null;

  // Update last_used_at non-blocking
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  return { orgId: key.org_id as string, keyId: key.id as string };
}

export async function hashKey(rawKey: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(rawKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function generateApiKey(): { raw: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const raw = `sk_live_${hex}`;
  const prefix = raw.slice(0, 16);
  return { raw, prefix };
}
