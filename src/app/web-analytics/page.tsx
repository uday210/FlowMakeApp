"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Globe, Plus, Trash2, X, Loader2, Copy, Check,
  BarChart2, Users, MousePointer, TrendingUp, ExternalLink,
  Monitor, Smartphone, Tablet, RefreshCw, ChevronDown, ChevronRight,
  Clock, Languages, MapPin, Cpu, List,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import WorldMap from "@/components/WorldMap";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  domain: string;
  script_key: string;
  created_at: string;
}

interface Stats {
  totals: {
    pageviews: number;
    events: number;
    sessions: number;
    unique_visitors: number;
    bounce_rate: number;
    avg_duration_ms: number;
  };
  top_pages: { value: string; count: number }[];
  top_referrers: { value: string; count: number }[];
  countries: { value: string; count: number }[];
  regions: { value: string; count: number }[];
  cities: { value: string; count: number }[];
  devices: { value: string; count: number }[];
  browsers: { value: string; count: number }[];
  os: { value: string; count: number }[];
  languages: { value: string; count: number }[];
  timezones: { value: string; count: number }[];
  resolutions: { value: string; count: number }[];
  chart: { date: string; views: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(ms: number): string {
  if (!ms) return "0s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function deviceIcon(device: string) {
  if (device === "mobile") return <Smartphone size={12} />;
  if (device === "tablet") return <Tablet size={12} />;
  return <Monitor size={12} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function TopList({ title, items, valueLabel = "Views" }: {
  title: string;
  items: { value: string; count: number }[];
  valueLabel?: string;
}) {
  const max = items[0]?.count ?? 1;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-700 mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-gray-700 truncate flex-1 mr-2" title={item.value}>
                    {item.value || "(direct)"}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0">{fmt(item.count)}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

// ─── Add Site Modal ───────────────────────────────────────────────────────────

function AddSiteModal({ onClose, onAdded }: { onClose: () => void; onAdded: (site: Site) => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim() || !domain.trim()) { setError("Both fields required"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/web-analytics/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), domain: domain.trim() }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    const site = await res.json();
    onAdded(site);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add website</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Site name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Website"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Domain</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">Without https:// — e.g. example.com</p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : "Add site"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Script Snippet ───────────────────────────────────────────────────────────

function ScriptSnippet({ site }: { site: Site }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin); }, []);
  const snippet = `<script defer src="${origin}/api/tracker?s=${site.script_key}"></script>`;

  return (
    <div className="bg-gray-900 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Paste in your &lt;head&gt;</p>
        <CopyButton text={snippet} />
      </div>
      <pre className="text-[11px] text-green-400 whitespace-pre-wrap break-all font-mono">{snippet}</pre>
    </div>
  );
}

// ─── Sessions view ────────────────────────────────────────────────────────────

interface SessionEvent {
  type: string;
  path: string | null;
  created_at: string;
  duration_ms?: number | null;
}

interface Session {
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
  events: SessionEvent[];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  pageview: "bg-violet-100 text-violet-700",
  click:    "bg-blue-100 text-blue-700",
  custom:   "bg-green-100 text-green-700",
  identify: "bg-amber-100 text-amber-700",
};

function SessionRow({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const pageviews = session.events.filter(e => e.type === "pageview");

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Device icon */}
        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
          {session.device === "mobile" ? <Smartphone size={13} className="text-violet-500" />
            : session.device === "tablet" ? <Tablet size={13} className="text-violet-500" />
            : <Monitor size={13} className="text-violet-500" />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-700">
              {pageviews.length} page{pageviews.length !== 1 ? "s" : ""}
            </span>
            {session.total_duration_ms > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <Clock size={9} /> {fmtDuration(session.total_duration_ms)}
              </span>
            )}
            {session.country && (
              <span className="text-[10px] text-gray-400">{session.city ? `${session.city}, ` : ""}{session.country}</span>
            )}
            {session.browser && (
              <span className="text-[10px] text-gray-400">{session.browser}{session.os ? ` · ${session.os}` : ""}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
            {pageviews.slice(0, 4).map((e, i) => (
              <span key={i} className="text-[10px] text-gray-400 truncate max-w-[120px]">
                {i > 0 && <span className="mx-0.5 text-gray-300">→</span>}
                {e.path || "/"}
              </span>
            ))}
            {pageviews.length > 4 && <span className="text-[10px] text-gray-400">+{pageviews.length - 4} more</span>}
          </div>
        </div>

        {/* Time + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-400">{timeAgo(session.started_at)}</span>
          {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50">
          <div className="mt-3 space-y-1">
            {session.events.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[11px]">
                <span className="text-[9px] text-gray-400 w-14 flex-shrink-0 font-mono">
                  {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${EVENT_TYPE_COLORS[e.type] ?? "bg-gray-100 text-gray-500"}`}>
                  {e.type}
                </span>
                <span className="text-gray-600 truncate flex-1">{e.path || "/"}</span>
                {e.duration_ms && e.duration_ms > 0 && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDuration(e.duration_ms)}</span>
                )}
              </div>
            ))}
          </div>
          {/* Session metadata */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
            {[
              session.visitor_id && { label: "Visitor", value: session.visitor_id.slice(0, 12) + "…" },
              session.language   && { label: "Language", value: session.language },
              session.timezone   && { label: "Timezone", value: session.timezone },
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="text-[10px]">
                <span className="text-gray-400">{(item as {label:string;value:string}).label}: </span>
                <span className="text-gray-600 font-medium">{(item as {label:string;value:string}).value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SessionsView({ siteId }: { siteId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const load = useCallback((d: number) => {
    setLoading(true);
    fetch(`/api/web-analytics/sites/${siteId}/sessions?days=${d}`)
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => { load(days); }, [load, days]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{sessions.length} sessions</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={days}
              onChange={e => { setDays(Number(e.target.value)); load(Number(e.target.value)); }}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-white appearance-none pr-7 cursor-pointer focus:outline-none"
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => load(days)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">No sessions recorded yet</div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => <SessionRow key={s.session_id} session={s} />)}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard view for a single site ────────────────────────────────────────

function SiteDashboard({ site, onBack }: { site: Site; onBack: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showScript, setShowScript] = useState(false);
  const [tab, setTab] = useState<"overview" | "sessions">("overview");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/web-analytics/sites/${site.id}/stats?days=${days}&domain=${encodeURIComponent(site.domain)}`)
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [site.id, site.domain, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
            ← All sites
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900">{site.name}</h2>
            <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-violet-600 hover:underline flex items-center gap-0.5">
              {site.domain} <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScript(v => !v)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Get snippet
          </button>
          {/* Days picker */}
          <div className="relative">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-white appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-400">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {showScript && <ScriptSnippet site={site} />}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "overview", label: "Overview", icon: <BarChart2 size={11} /> },
          { key: "sessions", label: "Sessions",  icon: <List size={11} /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <SessionsView siteId={site.id} />
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-gray-300" size={32} />
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard label="Page Views" value={fmt(stats.totals.pageviews)} icon={<BarChart2 size={16} />} />
            <StatCard label="Unique Visitors" value={fmt(stats.totals.unique_visitors)} icon={<Users size={16} />} />
            <StatCard label="Sessions" value={fmt(stats.totals.sessions)} icon={<MousePointer size={16} />} />
            <StatCard label="Bounce Rate" value={`${stats.totals.bounce_rate}%`} icon={<TrendingUp size={16} />} />
            <StatCard label="Avg Time on Page" value={fmtDuration(stats.totals.avg_duration_ms)} icon={<Clock size={16} />} />
            <StatCard label="Total Events" value={fmt(stats.totals.events)} icon={<Globe size={16} />} />
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-4">Page views over time</p>
            {stats.chart.every(d => d.views === 0) ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                No data yet — embed the tracking script on your site
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={stats.chart}>
                  <defs>
                    <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    labelFormatter={(label: unknown) => shortDate(String(label))}
                    formatter={(v: unknown) => [fmt(v as number), "Views"]}
                  />
                  <Area dataKey="views" stroke="#7c3aed" strokeWidth={2} fill="url(#waGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top pages + referrers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopList title="Top Pages" items={stats.top_pages} />
            <TopList title="Top Referrers" items={stats.top_referrers} valueLabel="Visits" />
          </div>

          {/* World Map */}
          <WorldMap countries={stats.countries} cities={stats.cities} />

          {/* Geo: Countries + Regions + Cities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TopList title="🌍 Countries" items={stats.countries} />
            <TopList title="📍 Regions" items={stats.regions} />
            <TopList title="🏙️ Cities" items={stats.cities} />
          </div>

          {/* Devices + Browsers + OS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Monitor size={12} /> Devices</p>
              {stats.devices.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.devices.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-400">{deviceIcon(d.value)}</span>
                      <span className="text-[11px] text-gray-700 flex-1 capitalize">{d.value}</span>
                      <span className="text-[11px] font-semibold text-gray-600">{fmt(d.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <TopList title="🌐 Browsers" items={stats.browsers} />
            <TopList title="💻 Operating Systems" items={stats.os} />
          </div>

          {/* Languages + Timezones + Screen Resolutions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Languages size={12} /> Languages</p>
              {stats.languages.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.languages.map((l, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-700">{l.value}</span>
                      <span className="text-[11px] font-semibold text-gray-600">{fmt(l.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Clock size={12} /> Timezones</p>
              {stats.timezones.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.timezones.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-700 truncate flex-1">{t.value}</span>
                      <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0">{fmt(t.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Cpu size={12} /> Screen Resolutions</p>
              {stats.resolutions.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.resolutions.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-700 font-mono">{r.value}</span>
                      <span className="text-[11px] font-semibold text-gray-600">{fmt(r.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 text-center py-12">Failed to load stats</p>
      )}
    </div>
  );
}


// ─── Sites list ───────────────────────────────────────────────────────────────

function SiteCard({ site, onSelect, onDelete }: {
  site: Site;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${site.name}"? All analytics data will be lost.`)) return;
    setDeleting(true);
    await fetch(`/api/web-analytics/sites/${site.id}`, { method: "DELETE" });
    onDelete();
  };

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Globe size={16} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{site.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{site.domain}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          Added {new Date(site.created_at).toLocaleDateString()}
        </span>
        <span className="text-[10px] text-violet-600 font-medium group-hover:underline">
          View analytics →
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebAnalyticsPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const loadSites = useCallback(() => {
    setLoading(true);
    fetch("/api/web-analytics/sites")
      .then(r => r.json())
      .then(d => setSites(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  if (selectedSite) {
    return (
      <AppShell>
        <PageHeader
          title={selectedSite.name}
          subtitle={selectedSite.domain}
        />
        <SiteDashboard site={selectedSite} onBack={() => setSelectedSite(null)} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Web Analytics"
        subtitle="Track visitors and page views across your websites"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={15} /> Add website
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-gray-300" size={32} />
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <BarChart2 size={24} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">No websites yet</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Add your first website and embed the tracking script to start seeing visitor data.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Plus size={15} /> Add website
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => (
              <SiteCard
                key={site.id}
                site={site}
                onSelect={() => setSelectedSite(site)}
                onDelete={() => setSites(prev => prev.filter(s => s.id !== site.id))}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddSiteModal
          onClose={() => setShowAdd(false)}
          onAdded={site => setSites(prev => [site, ...prev])}
        />
      )}
    </AppShell>
  );
}
