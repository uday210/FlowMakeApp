import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/mcp-toolboxes/[id]/analytics?days=7
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify server belongs to org
  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "7"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await ctx.admin
    .from("mcp_tool_executions")
    .select("tool_name, status, duration_ms, created_at")
    .eq("server_id", id)
    .eq("org_id", ctx.orgId)
    .gte("created_at", since);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];

  // --- summary ---
  const total_calls = rows.length;
  const error_calls = rows.filter((r) => r.status === "error").length;
  const success_calls = total_calls - error_calls;
  const error_rate = total_calls > 0 ? error_calls / total_calls : 0;

  const durations = rows
    .map((r) => r.duration_ms as number | null)
    .filter((d): d is number => d != null);
  const avg_duration_ms =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  // p95
  const sorted = [...durations].sort((a, b) => a - b);
  const p95_duration_ms =
    sorted.length > 0
      ? sorted[Math.floor(sorted.length * 0.95)]
      : 0;

  // --- by_tool ---
  const toolMap = new Map<string, { calls: number; errors: number; total_ms: number }>();
  for (const row of rows) {
    const name: string = row.tool_name ?? "unknown";
    const entry = toolMap.get(name) ?? { calls: 0, errors: 0, total_ms: 0 };
    entry.calls += 1;
    if (row.status === "error") entry.errors += 1;
    if (row.duration_ms != null) entry.total_ms += row.duration_ms as number;
    toolMap.set(name, entry);
  }
  const by_tool = Array.from(toolMap.entries()).map(([tool_name, e]) => ({
    tool_name,
    calls: e.calls,
    errors: e.errors,
    avg_ms: e.calls > 0 ? Math.round(e.total_ms / e.calls) : 0,
  }));

  // --- by_day ---
  const dayMap = new Map<string, { calls: number; errors: number }>();
  for (const row of rows) {
    const date = (row.created_at as string).slice(0, 10); // YYYY-MM-DD
    const entry = dayMap.get(date) ?? { calls: 0, errors: 0 };
    entry.calls += 1;
    if (row.status === "error") entry.errors += 1;
    dayMap.set(date, entry);
  }
  const by_day = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({ date, calls: e.calls, errors: e.errors }));

  // Build calls_by_tool map expected by the frontend
  const calls_by_tool: Record<string, number> = {};
  for (const t of by_tool) calls_by_tool[t.tool_name] = t.calls;

  return NextResponse.json({
    total_calls,
    error_rate: parseFloat(error_rate.toFixed(4)),
    avg_duration_ms,
    calls_by_tool,
    calls_by_day: by_day,
  });
}
