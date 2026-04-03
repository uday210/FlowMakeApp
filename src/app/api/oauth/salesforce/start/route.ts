import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.SALESFORCE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "SALESFORCE_CLIENT_ID not configured" }, { status: 500 });

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
  const redirectUri = `${appUrl}/api/oauth/salesforce/callback`;

  // Support sandbox via ?sandbox=1
  const isSandbox = request.nextUrl.searchParams.get("sandbox") === "1";
  const baseUrl = isSandbox
    ? "https://test.salesforce.com"
    : "https://login.salesforce.com";

  const state = Buffer.from(JSON.stringify({ orgId: ctx.orgId, isSandbox })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "api refresh_token offline_access openid profile email",
    state,
  });

  return NextResponse.redirect(`${baseUrl}/services/oauth2/authorize?${params}`);
}
