import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

function topN(items: (string | null)[], n = 8): { value: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const v of items) {
    const key = v ?? "Unknown";
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const { data: site } = await ctx.admin
    .from("web_analytics_sites")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 365);
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: events, error } = await ctx.admin
    .from("web_analytics_events")
    .select("type, path, referrer, country, region, city, device, browser, os, session_id, visitor_id, language, timezone, screen_width, screen_height, duration_ms, is_logged_in, created_at")
    .eq("site_id", id)
    .gte("created_at", from)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pageviews = events?.filter(e => e.type === "pageview") ?? [];
  const allEvents = events ?? [];

  // Unique sets
  const uniqueSessions = new Set(pageviews.map(e => e.session_id).filter(Boolean));
  const uniqueVisitors = new Set(pageviews.map(e => e.visitor_id).filter(Boolean));

  // Bounce rate
  const sessionPageviews: Record<string, number> = {};
  for (const e of pageviews) {
    if (e.session_id) sessionPageviews[e.session_id] = (sessionPageviews[e.session_id] ?? 0) + 1;
  }
  const bouncedSessions = Object.values(sessionPageviews).filter(c => c === 1).length;
  const bounceRate = uniqueSessions.size > 0
    ? Math.round((bouncedSessions / uniqueSessions.size) * 100)
    : 0;

  // Avg session duration
  const durations = allEvents
    .filter(e => e.type === "duration" && e.duration_ms && e.duration_ms > 0)
    .map(e => e.duration_ms as number);
  const avgDuration = avg(durations);

  // Daily chart data
  const dailyMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400_000);
    dailyMap[dayKey(d.toISOString())] = 0;
  }
  for (const e of pageviews) {
    const k = dayKey(e.created_at);
    if (k in dailyMap) dailyMap[k]++;
  }
  const chart = Object.entries(dailyMap).map(([date, views]) => ({ date, views }));

  // Screen resolutions
  const resolutions = topN(
    allEvents
      .filter(e => e.screen_width && e.screen_height)
      .map(e => `${e.screen_width}×${e.screen_height}`),
    8
  );

  return NextResponse.json({
    totals: {
      pageviews:       pageviews.length,
      events:          allEvents.length,
      sessions:        uniqueSessions.size,
      unique_visitors: uniqueVisitors.size,
      bounce_rate:     bounceRate,
      avg_duration_ms: avgDuration,
    },
    top_pages:    topN(pageviews.map(e => e.path ?? ""), 10),
    top_referrers: topN(
      pageviews
        .map(e => e.referrer ?? "")
        .filter(r => r && !r.includes(searchParams.get("domain") ?? "")),
      8
    ),
    countries:    topN(allEvents.map(e => e.country), 10),
    regions:      topN(allEvents.map(e => e.region), 8),
    cities:       topN(allEvents.map(e => e.city), 10),
    devices:      topN(allEvents.map(e => e.device), 5),
    browsers:     topN(allEvents.map(e => e.browser), 6),
    os:           topN(allEvents.map(e => e.os), 6),
    languages:    topN(allEvents.map(e => e.language), 8),
    timezones:    topN(allEvents.map(e => e.timezone), 8),
    resolutions,
    chart,
  });
}
