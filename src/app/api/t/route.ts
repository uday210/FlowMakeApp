import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Simple UA parsing — no external deps
function parseDevice(ua: string): string {
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return "mobile";
  if (/iPad|Tablet/.test(ua)) return "tablet";
  return "desktop";
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function parseOS(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function getPath(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { siteKey, type = "pageview", url, referrer, sessionId, visitorId, properties } = body;

    if (!siteKey) return NextResponse.json({ error: "Missing siteKey" }, { status: 400 });

    const admin = createServerClient();

    // Look up site by script_key
    const { data: site } = await admin
      .from("web_analytics_sites")
      .select("id")
      .eq("script_key", siteKey)
      .single();

    if (!site) return NextResponse.json({ error: "Unknown site" }, { status: 404 });

    // Extract metadata
    const ua = request.headers.get("user-agent") ?? "";
    const country =
      request.headers.get("cf-ipcountry") ??
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("x-country") ??
      null;

    await admin.from("web_analytics_events").insert({
      site_id:    site.id,
      type,
      url:        url ?? null,
      path:       url ? getPath(url) : null,
      referrer:   referrer ?? null,
      country,
      device:     parseDevice(ua),
      browser:    parseBrowser(ua),
      os:         parseOS(ua),
      session_id: sessionId ?? null,
      visitor_id: visitorId ?? null,
      properties: properties ?? {},
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders(request) });
  }
}

// Allow preflight from any origin (tracking script is cross-origin)
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

function corsHeaders(request: Request) {
  // When credentials mode is "include" (Salesforce, etc.), wildcard is not allowed.
  // Reflect the exact requesting origin back.
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}
