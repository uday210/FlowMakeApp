import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/orgContext";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("x-forwarded-host")}`;
  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  // Encode org context in state param
  const state = Buffer.from(JSON.stringify({ orgId: ctx.orgId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
