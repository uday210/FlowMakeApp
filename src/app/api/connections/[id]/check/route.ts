import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn, error } = await ctx.admin
    .from("connections")
    .select("type, config")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (error || !conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cfg = conn.config as Record<string, string>;

  try {
    switch (conn.type) {
      case "salesforce": {
        if (!cfg.instance_url || !cfg.access_token) {
          return NextResponse.json({ status: "error", message: "Missing credentials" });
        }
        const res = await fetch(`${cfg.instance_url}/services/data/v59.0/limits`, {
          headers: { Authorization: `Bearer ${cfg.access_token}` },
        });
        if (res.ok) return NextResponse.json({ status: "ok" });
        if (res.status === 401) return NextResponse.json({ status: "expired", message: "Token expired — re-authenticate to reconnect" });
        return NextResponse.json({ status: "error", message: `Salesforce returned ${res.status}` });
      }

      case "google": {
        if (!cfg.access_token) return NextResponse.json({ status: "error", message: "Missing access token" });
        const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${cfg.access_token}`);
        if (res.ok) return NextResponse.json({ status: "ok" });
        if (res.status === 400) return NextResponse.json({ status: "expired", message: "Token expired — re-authenticate to reconnect" });
        return NextResponse.json({ status: "error", message: `Google returned ${res.status}` });
      }

      case "airtable": {
        if (!cfg.access_token) return NextResponse.json({ status: "error", message: "Missing access token" });
        const res = await fetch("https://api.airtable.com/v0/meta/whoami", {
          headers: { Authorization: `Bearer ${cfg.access_token}` },
        });
        if (res.ok) return NextResponse.json({ status: "ok" });
        if (res.status === 401) return NextResponse.json({ status: "expired", message: "Token expired — re-authenticate to reconnect" });
        return NextResponse.json({ status: "error", message: `Airtable returned ${res.status}` });
      }

      default:
        // API-key based connections — no live ping available
        return NextResponse.json({ status: "unchecked", message: "Live check not available for this service" });
    }
  } catch {
    return NextResponse.json({ status: "error", message: "Could not reach service" });
  }
}
