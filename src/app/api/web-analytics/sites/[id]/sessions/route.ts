import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: site } = await ctx.admin
    .from("web_analytics_sites")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const days  = Math.min(parseInt(searchParams.get("days") ?? "7"), 90);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const from  = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: events, error } = await ctx.admin
    .from("web_analytics_events")
    .select("type, path, url, referrer, country, city, device, browser, os, session_id, visitor_id, language, timezone, duration_ms, created_at")
    .eq("site_id", id)
    .gte("created_at", from)
    .not("session_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group events by session_id
  const sessionMap = new Map<string, {
    session_id: string;
    visitor_id: string | null;
    started_at: string;
    ended_at: string;
    country: string | null;
    city: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    language: string | null;
    timezone: string | null;
    total_duration_ms: number;
    events: { type: string; path: string | null; created_at: string; duration_ms?: number | null }[];
  }>();

  for (const e of events ?? []) {
    if (!e.session_id) continue;
    if (!sessionMap.has(e.session_id)) {
      sessionMap.set(e.session_id, {
        session_id:        e.session_id,
        visitor_id:        e.visitor_id,
        started_at:        e.created_at,
        ended_at:          e.created_at,
        country:           e.country,
        city:              e.city,
        device:            e.device,
        browser:           e.browser,
        os:                e.os,
        language:          e.language,
        timezone:          e.timezone,
        total_duration_ms: 0,
        events:            [],
      });
    }
    const s = sessionMap.get(e.session_id)!;
    s.ended_at = e.created_at;
    if (e.duration_ms) s.total_duration_ms += e.duration_ms;
    if (e.type !== "duration") {
      s.events.push({ type: e.type, path: e.path, created_at: e.created_at, duration_ms: e.duration_ms });
    }
  }

  // Sort sessions newest first, limit
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, limit);

  return NextResponse.json(sessions);
}
