import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

function base64url(buf: ArrayBuffer | Uint8Array) {
  return Buffer.from(buf instanceof Uint8Array ? buf.buffer : buf).toString("base64url");
}

export async function GET(request: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.SALESFORCE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "SALESFORCE_CLIENT_ID not configured" }, { status: 500 });

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const redirectUri = `${appUrl}/api/oauth/salesforce/callback`;

  const isSandbox = request.nextUrl.searchParams.get("sandbox") === "1";
  const baseUrl = isSandbox ? "https://test.salesforce.com" : "https://login.salesforce.com";

  // Generate PKCE
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64url(verifierBytes);
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(challengeBytes);

  const state = Buffer.from(JSON.stringify({ orgId: ctx.orgId, isSandbox })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "api refresh_token offline_access openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(`${baseUrl}/services/oauth2/authorize?${params}`);

  response.cookies.set("salesforce_cv", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
