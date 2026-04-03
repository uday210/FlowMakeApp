import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

const SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
  "schema.bases:write",
  "webhook:manage",
].join(" ");

function base64url(buf: ArrayBuffer | Uint8Array) {
  return Buffer.from(buf instanceof Uint8Array ? buf.buffer : buf).toString("base64url");
}

export async function GET(request: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.AIRTABLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "AIRTABLE_CLIENT_ID not configured" }, { status: 500 });

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const redirectUri = `${appUrl}/api/oauth/airtable/callback`;

  // Generate PKCE code_verifier + code_challenge
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64url(verifierBytes);
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(challengeBytes);

  // Encode org context in state
  const state = Buffer.from(JSON.stringify({ orgId: ctx.orgId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://airtable.com/oauth2/v1/authorize?${params}`
  );

  // Store code_verifier in a short-lived cookie for the callback
  response.cookies.set("airtable_cv", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
