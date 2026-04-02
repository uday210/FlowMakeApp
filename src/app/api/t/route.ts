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

function getClientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    null
  );
}

interface GeoResult {
  country: string | null;
  region:  string | null;
  city:    string | null;
}

// Cache geo lookups in memory for the lifetime of the process to avoid hammering the API
const geoCache = new Map<string, GeoResult>();

async function getGeo(request: Request): Promise<GeoResult> {
  // 1. Try Cloudflare / Vercel / Railway headers first (no external call needed)
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country") ??
    null;

  const region =
    request.headers.get("cf-region-code") ??
    request.headers.get("x-vercel-ip-country-region") ??
    null;

  const city =
    request.headers.get("cf-ipcity") ??
    request.headers.get("x-vercel-ip-city") ??
    null;

  if (country) return { country, region, city };

  // 2. Fall back to free IP geo API (ip-api.com — 45 req/min, no key needed)
  const ip = getClientIp(request);
  if (!ip || ip === "127.0.0.1" || ip === "::1") return { country: null, region: null, city: null };

  if (geoCache.has(ip)) return geoCache.get(ip)!;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "success") {
        const geo = { country: data.country ?? null, region: data.regionName ?? null, city: data.city ?? null };
        geoCache.set(ip, geo);
        return geo;
      }
    }
  } catch {
    // geo failed — non-critical, continue without it
  }

  return { country: null, region: null, city: null };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      siteKey, type = "pageview", url, referrer,
      sessionId, visitorId, properties,
      // new fields from enhanced tracker
      screen_width, screen_height, language, timezone, duration_ms,
    } = body;

    if (!siteKey) return NextResponse.json({ error: "Missing siteKey" }, { status: 400, headers: corsHeaders(request) });

    const admin = createServerClient();

    // Look up site by script_key
    const { data: site } = await admin
      .from("web_analytics_sites")
      .select("id")
      .eq("script_key", siteKey)
      .single();

    if (!site) return NextResponse.json({ error: "Unknown site" }, { status: 404, headers: corsHeaders(request) });

    // Extract metadata
    const ua = request.headers.get("user-agent") ?? "";
    const geo = await getGeo(request);

    await admin.from("web_analytics_events").insert({
      site_id:       site.id,
      type,
      url:           url ?? null,
      path:          url ? getPath(url) : null,
      referrer:      referrer ?? null,
      country:       geo.country,
      region:        geo.region,
      city:          geo.city,
      device:        parseDevice(ua),
      browser:       parseBrowser(ua),
      os:            parseOS(ua),
      session_id:    sessionId ?? null,
      visitor_id:    visitorId ?? null,
      language:      language ?? null,
      timezone:      timezone ?? null,
      screen_width:  screen_width ?? null,
      screen_height: screen_height ?? null,
      duration_ms:   duration_ms ?? null,
      is_logged_in:  properties?.is_logged_in ?? false,
      properties:    properties ?? {},
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders(request) });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}
