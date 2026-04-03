import type { SupabaseClient } from "@supabase/supabase-js";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID!;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET!;

/**
 * Refresh a Salesforce OAuth access token using the stored refresh_token.
 * Updates the connection record in Supabase with the new access_token.
 * Returns the new access_token, or throws on failure.
 */
export async function refreshAccessToken(
  supabase: SupabaseClient,
  connectionId: string,
  refreshToken: string,
  instanceUrl: string
): Promise<string> {
  const tokenUrl = `${instanceUrl}/services/oauth2/token`;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  }

  const newAccessToken = data.access_token as string;
  const expiry = Date.now() + ((data.expires_in as number) ?? 3600) * 1000;

  // Persist refreshed token to Supabase so other parts of the app benefit
  const { data: conn } = await supabase
    .from("connections")
    .select("config")
    .eq("id", connectionId)
    .single();

  if (conn) {
    const updatedConfig = {
      ...(conn.config as Record<string, unknown>),
      access_token: newAccessToken,
      expiry,
    };
    await supabase
      .from("connections")
      .update({ config: updatedConfig })
      .eq("id", connectionId);
  }

  return newAccessToken;
}
