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
    const desc = url.searchParams.get("error_description") ?? error ?? "missing_code";
    console.error("[airtable/callback] OAuth error:", error, desc);
    return go(`/connections?error=${encodeURIComponent(desc)}`);
  }

  let orgId: string;
  let label = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    orgId = decoded.orgId;
    label = decoded.label ?? "";
  } catch {
    return go("/connections?error=invalid_state");
  }

  const codeVerifier = request.cookies.get("airtable_cv")?.value;
  if (!codeVerifier) return go("/connections?error=missing_code_verifier");

  const clientId = process.env.AIRTABLE_CLIENT_ID!;
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/airtable/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://airtable.com/oauth2/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("[airtable/callback] token error:", tokens);
    return go("/connections?error=token_exchange_failed");
  }

  // Get user info to label the connection
  const userRes = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();
  const providerName = userInfo.email ?? userInfo.id ?? "Airtable Account";
  const name = label || providerName;

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("connections")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "airtable")
    .single();

  const config = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    email: name,
  };

  if (existing) {
    await supabase.from("connections").update({ config, name }).eq("id", existing.id);
  } else {
    await supabase.from("connections").insert({ org_id: orgId, type: "airtable", name, config });
  }

  const res = go("/connections?success=airtable_connected");
  res.cookies.set("airtable_cv", "", { maxAge: 0, path: "/" });
  return res;
}
