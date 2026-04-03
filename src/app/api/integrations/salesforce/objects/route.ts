import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/salesforce/objects
 * Authenticates with Salesforce using the provided credentials and returns
 * all available sObjects (standard + custom), sorted alphabetically.
 */
export async function POST(request: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    // OAuth connection path
    access_token?: string;
    instance_url?: string;
    // Client credentials / password path
    auth_flow?: string;
    environment?: string;
    login_url?: string;
    client_id?: string;
    client_secret?: string;
    username?: string;
    password?: string;
    security_token?: string;
  };

  let access_token: string;
  let instance_url: string;

  if (body.access_token && body.instance_url) {
    // OAuth connection — tokens already available
    access_token = body.access_token;
    instance_url = body.instance_url;
  } else {
    const { auth_flow = "password", environment = "production", login_url, client_id, client_secret, username, password, security_token } = body;

    if (!client_id || !client_secret) {
      return NextResponse.json({ error: "client_id and client_secret are required" }, { status: 400 });
    }

    const baseLoginUrl = (() => {
      const custom = login_url?.trim().replace(/\/$/, "");
      if (custom) return custom;
      if (environment === "sandbox") return "https://test.salesforce.com";
      return "https://login.salesforce.com";
    })();

    const params = new URLSearchParams({ grant_type: auth_flow === "client_credentials" ? "client_credentials" : "password", client_id, client_secret });
    if (auth_flow !== "client_credentials") {
      if (!username) return NextResponse.json({ error: "username is required for password flow" }, { status: 400 });
      params.set("username", username);
      params.set("password", `${password ?? ""}${security_token ?? ""}`);
    }

    const tokenRes = await fetch(`${baseLoginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json({ error: tokenData.error_description || "Salesforce authentication failed" }, { status: 400 });
    }
    access_token = tokenData.access_token as string;
    instance_url = tokenData.instance_url as string;
  }

  // Fetch all sObjects
  const sobjectsRes = await fetch(`${instance_url}/services/data/v59.0/sobjects/`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!sobjectsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Salesforce objects" }, { status: 502 });
  }

  const sobjectsData = await sobjectsRes.json() as {
    sobjects: { name: string; label: string; queryable: boolean; createable: boolean }[];
  };

  const objects = (sobjectsData.sobjects ?? [])
    .filter((o) => o.queryable || o.createable)
    .map((o) => ({ value: o.name, label: `${o.label} (${o.name})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({ objects });
}
