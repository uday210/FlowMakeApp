import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const go = (path: string) => NextResponse.redirect(`${appUrl}${path}`);

  if (error || !code || !state) {
    const desc = url.searchParams.get("error_description") ?? error ?? "oauth_failed";
    console.error("[salesforce/callback] error:", error, desc);
    return go(`/connections?error=${encodeURIComponent(desc)}`);
  }

  let orgId: string;
  let isSandbox = false;
  let label = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    orgId = decoded.orgId;
    isSandbox = decoded.isSandbox ?? false;
    label = decoded.label ?? "";
  } catch {
    return go("/connections?error=invalid_state");
  }

  const codeVerifier = request.cookies.get("salesforce_cv")?.value;
  if (!codeVerifier) return go("/connections?error=missing_code_verifier");

  const clientId = process.env.SALESFORCE_CLIENT_ID!;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/salesforce/callback`;
  const baseUrl = isSandbox ? "https://test.salesforce.com" : "https://login.salesforce.com";

  // Exchange code for tokens (with PKCE verifier)
  const tokenRes = await fetch(`${baseUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("[salesforce/callback] token error:", tokens);
    return go("/connections?error=token_exchange_failed");
  }

  // instance_url is critical — it's the Salesforce org's unique API base URL
  const instanceUrl = tokens.instance_url as string;

  // Get user info via identity URL returned in token response
  const identityUrl = (tokens.id as string) || `${instanceUrl}/services/oauth2/userinfo`;
  const userRes = await fetch(identityUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userRes.ok ? await userRes.json() : {};
  const providerName = userInfo.email ?? userInfo.preferred_username ?? userInfo.username ?? "Salesforce Account";
  const name = label || providerName;

  const supabase = createServerClient();

  const config = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    instance_url: instanceUrl,
    issued_at: tokens.issued_at,
    email: name,
    sandbox: isSandbox,
  };

  await supabase.from("connections").insert({
    org_id: orgId,
    type: "salesforce",
    name,
    config,
  });

  const res = go("/connections?success=salesforce_connected");
  res.cookies.set("salesforce_cv", "", { maxAge: 0, path: "/" });
  return res;
}
