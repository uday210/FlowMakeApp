import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("x-forwarded-host")}`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/connections?error=google_oauth_failed`);
  }

  let orgId: string;
  let label = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    orgId = decoded.orgId;
    label = decoded.label ?? "";
  } catch {
    return NextResponse.redirect(`${appUrl}/connections?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/connections?error=token_exchange_failed`);
  }

  // Get user email to label the connection
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();
  const email = userInfo.email ?? "Google Account";

  const supabase = createServerClient();

  const displayName = label || email;

  const config = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    email,
  };

  await supabase.from("connections").insert({
    org_id: orgId, type: "google", name: displayName, config,
  });

  return NextResponse.redirect(`${appUrl}/connections?success=google_connected`);
}
