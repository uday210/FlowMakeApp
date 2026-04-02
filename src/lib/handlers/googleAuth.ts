/**
 * Shared Google OAuth helper.
 * Accepts either a raw access_token OR client_email + private_key (service account).
 * Automatically generates a short-lived access token from service account credentials.
 */

const EXCLUDED_KEYS = ["id", "_created_at"];

export async function getGoogleAccessToken(
  config: Record<string, unknown>,
  scope: string
): Promise<string> {
  const accessToken = config.access_token as string | undefined;
  const clientEmail = config.client_email as string | undefined;
  const privateKey = (config.private_key as string | undefined)?.replace(/\\n/g, "\n");

  if (accessToken) return accessToken;

  if (!clientEmail || !privateKey) {
    throw new Error("Provide either access_token or client_email + private_key (service account)");
  }

  const now = Math.floor(Date.now() / 1000);
  const toB64Url = (s: string) =>
    btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  const header = toB64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = toB64Url(JSON.stringify({
    iss: clientEmail, scope, aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));

  const sigInput = `${header}.${claim}`;
  const keyData = privateKey.replace(
    /-----BEGIN (RSA )?PRIVATE KEY-----|-----END (RSA )?PRIVATE KEY-----|\n/g, ""
  );
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${sigInput}.${sigB64}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Google auth failed: ${tokenData.error_description || tokenData.error}`);
  return tokenData.access_token as string;
}

/** Convert array of row objects to 2D array, optionally with header row */
export function normalizeSheetValues(raw: unknown, includeHeaders = false): unknown[][] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) throw new Error("Values must be a JSON array");
  if (parsed.length === 0) return [];
  if (typeof parsed[0] === "object" && !Array.isArray(parsed[0]) && parsed[0] !== null) {
    const keys = Object.keys(parsed[0] as object).filter(k => !EXCLUDED_KEYS.includes(k));
    const rows = parsed.map((obj: Record<string, unknown>) => keys.map(k => obj[k] ?? ""));
    return includeHeaders ? [keys, ...rows] : rows;
  }
  return parsed as unknown[][];
}
