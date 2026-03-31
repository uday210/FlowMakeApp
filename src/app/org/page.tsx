"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  LayoutDashboard, Users, UserCircle, CreditCard, BarChart2,
  Receipt, Puzzle, Variable, Settings2, Bell, Bot,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, Zap, Sparkles, ChevronRight, RefreshCw,
  Activity, Globe, Loader2, Save, Infinity, KeyRound, Plug2,
  Table2, Check, Crown, Mail, Plus, Trash2, ShieldCheck, X,
} from "lucide-react";
import { PLAN_LIMITS, PLAN_LABELS, type PlanName, type ResourceKey } from "@/lib/plan-limits";
import type { Execution } from "@/lib/types";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  timezone: string;
}

// ─── Left Sidebar Nav ─────────────────────────────────────────────────────────

const ORG_NAV = [
  {
    section: "Organization",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "settings", label: "Settings", icon: Settings2 },
      { id: "teams", label: "Teams", icon: Users },
      { id: "users", label: "Users", icon: UserCircle },
    ],
  },
  {
    section: "My Plan",
    items: [
      { id: "subscription", label: "Subscription", icon: CreditCard },
      { id: "credit-usage", label: "Credit usage", icon: BarChart2 },
      { id: "payments", label: "Payments", icon: Receipt },
    ],
  },
  {
    section: "Utilities",
    items: [
      { id: "installed-apps", label: "Installed apps", icon: Puzzle },
      { id: "variables", label: "Variables", icon: Variable },
      { id: "notifications", label: "Notification options", icon: Bell },
      { id: "email", label: "Email Accounts", icon: Mail },
    ],
  },
];

// ─── Mini Usage Sparkline ─────────────────────────────────────────────────────

function MiniSparkline({ data, color = "#7c3aed" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const W = 120, H = 36, pad = 2;
  const stepX = (W - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + (H - pad * 2) - (v / max) * (H - pad * 2),
  }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${H - pad} ${polyline} ${pts[pts.length - 1].x},${H - pad}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, sparkData, color = "#7c3aed", trend,
}: {
  label: string;
  value: string;
  sub?: string;
  sparkData?: number[];
  color?: string;
  trend?: { dir: "up" | "down" | "neutral"; label: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-semibold ${
              trend.dir === "up" ? "text-green-500" : trend.dir === "down" ? "text-red-400" : "text-gray-400"
            }`}>
              {trend.dir === "up" ? <TrendingUp size={10} /> : trend.dir === "down" ? <TrendingUp size={10} className="rotate-180" /> : <Activity size={10} />}
              {trend.label}
            </div>
          )}
        </div>
        {sparkData && <MiniSparkline data={sparkData} color={color} />}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface WorkflowRow {
  id: string;
  name: string;
  is_active: boolean;
  updated_at: string;
}

type UsageData = {
  plan: PlanName;
  limits: Record<ResourceKey, number | null>;
  usage: Record<ResourceKey, number>;
};

export default function OrgDashboard() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  // Generate deterministic 30-day sparkline data (no Math.random — avoids hydration mismatch)
  const dailyUsageData = Array.from({ length: 30 }, (_, i) =>
    Math.max(0, Math.round(Math.sin(i * 0.4) * 3 + Math.abs(Math.sin(i * 1.3)) * 4))
  );

  useEffect(() => {
    fetch("/api/org").then(r => r.json()).then(d => { if (d && !d.error) setOrg(d); }).catch(() => {});
    fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/org/usage").then(r => r.json()).then(d => { if (!d.error) setUsageData(d); }).catch(() => {});
    setLoading(false);
  }, []);

  const activeScenarios = workflows.filter(w => w.is_active).length;
  const totalScenarios = workflows.length;

  // Scenarios with issues: inactive ones with recent activity OR all inactive ones
  const scenariosNeedingAttention = workflows
    .filter(w => !w.is_active)
    .slice(0, 5);

  const resetDate = new Date();
  resetDate.setDate(1);
  resetDate.setMonth(resetDate.getMonth() + 1);
  const daysUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / 86400000);

  if (activeNav === "settings") {
    return (
      <AppShell>
        <div className="flex h-full overflow-hidden">
          <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} org={org} />
          <OrgSettings org={org} onSaved={setOrg} />
        </div>
      </AppShell>
    );
  }

  if (activeNav === "subscription") {
    return (
      <AppShell>
        <div className="flex h-full overflow-hidden">
          <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} org={org} />
          <SubscriptionPanel
            usageData={usageData}
            org={org}
            onUpgraded={(plan) => {
              setOrg(prev => prev ? { ...prev, plan } : prev);
              fetch("/api/org/usage").then(r => r.json()).then(d => { if (!d.error) setUsageData(d); });
            }}
          />
        </div>
      </AppShell>
    );
  }

  if (activeNav === "email") {
    return (
      <AppShell>
        <div className="flex h-full overflow-hidden">
          <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} org={org} />
          <EmailConfigsPanel />
        </div>
      </AppShell>
    );
  }

  if (activeNav !== "dashboard") {
    return (
      <AppShell>
        <div className="flex h-full">
          <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} org={org} />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">This section is coming soon.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Left org sidebar */}
        <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} org={org} />

        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-[#f8f9fc]">
          {/* Top bar */}
          <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Organization overview</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLoading(l => !l)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => router.push("/workflows")}
                className="flex items-center gap-2 text-xs font-semibold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
              >
                <Zap size={13} />
                New Scenario
              </button>
            </div>
          </header>

          <div className="px-8 py-6 space-y-8">

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="Average daily usage"
                value={`${(dailyUsageData.reduce((a, b) => a + b, 0) / 30).toFixed(1)}`}
                sub="operations / day"
                sparkData={dailyUsageData}
                color="#7c3aed"
                trend={{ dir: "up", label: "+12% this month" }}
              />
              <StatCard
                label="Credits left"
                value="1,000"
                sub="of 1,000 total"
                sparkData={[1000, 1000, 1000, 1000, 1000, 1000, 1000]}
                color="#10b981"
                trend={{ dir: "neutral", label: "Full plan" }}
              />
              <StatCard
                label="Usage resets in"
                value={`${daysUntilReset}`}
                sub="days"
                color="#f59e0b"
                trend={{ dir: "neutral", label: `Resets ${resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` }}
              />
              <StatCard
                label="Active scenarios"
                value={`${activeScenarios}`}
                sub={`of ${totalScenarios} total`}
                sparkData={Array.from({ length: 7 }, (_, i) => i < activeScenarios ? 1 : 0)}
                color="#3b82f6"
                trend={{ dir: activeScenarios > 0 ? "up" : "neutral", label: activeScenarios > 0 ? "Running" : "None active" }}
              />
            </div>

            {/* ── Plan usage strip ── */}
            {usageData && <PlanUsageStrip usageData={usageData} onManage={() => setActiveNav("subscription")} />}

            {/* ── Scenarios that require attention ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <h2 className="text-sm font-semibold text-gray-800">Scenarios that require attention</h2>
                  {scenariosNeedingAttention.length > 0 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                      {scenariosNeedingAttention.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push("/workflows")}
                  className="text-xs text-violet-500 hover:text-violet-700 flex items-center gap-1 font-medium"
                >
                  View all <ChevronRight size={12} />
                </button>
              </div>

              {scenariosNeedingAttention.length === 0 ? (
                <div className="px-6 py-10 flex flex-col items-center gap-2">
                  <CheckCircle2 size={28} className="text-green-400" />
                  <p className="text-sm font-medium text-gray-600">All scenarios are healthy</p>
                  <p className="text-xs text-gray-400">No issues detected</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {scenariosNeedingAttention.map(w => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/workflows/${w.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={13} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{w.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock size={9} /> Inactive · Last updated {new Date(w.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                          Inactive
                        </span>
                        <ArrowRight size={13} className="text-gray-300 group-hover:text-violet-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Level up with AI Agents ── */}
            <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="px-8 py-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">New feature</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Level up with AI Agents</h2>
                  <p className="text-sm text-violet-200 max-w-lg leading-relaxed">
                    Build autonomous agents that think, plan, and execute multi-step tasks.
                    Connect Claude, OpenAI, or Gemini to your workflows with built-in tool use and memory.
                  </p>
                  <button
                    onClick={() => router.push("/workflows")}
                    className="mt-4 flex items-center gap-2 bg-white text-violet-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-50 transition-colors shadow-sm"
                  >
                    <Bot size={15} />
                    Create AI Agent
                    <ArrowRight size={13} />
                  </button>
                </div>
                <div className="hidden lg:flex items-center justify-center w-48 h-36 flex-shrink-0">
                  <div className="relative">
                    {/* Decorative agent visualization */}
                    <div className="w-20 h-20 bg-white/15 rounded-full flex items-center justify-center border border-white/20 shadow-xl">
                      <Bot size={36} className="text-white" />
                    </div>
                    {[
                      { icon: Sparkles, delay: "0s", pos: "-top-4 -right-4" },
                      { icon: Zap, delay: "0.3s", pos: "-bottom-2 -right-6" },
                      { icon: Activity, delay: "0.6s", pos: "-bottom-4 -left-4" },
                    ].map(({ icon: Icon, delay, pos }, i) => (
                      <div
                        key={i}
                        className={`absolute ${pos} w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center border border-white/20`}
                        style={{ animation: `pulse 2s ease-in-out ${delay} infinite` }}
                      >
                        <Icon size={14} className="text-white" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Agent capability pills */}
              <div className="px-8 pb-6 flex flex-wrap gap-2">
                {["Tool use", "Memory", "Multi-step reasoning", "Parallel execution", "Error recovery"].map(cap => (
                  <span key={cap} className="text-[10px] font-semibold text-violet-200 bg-white/10 border border-white/15 px-3 py-1 rounded-full">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Recent activity ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-800">All scenarios</h2>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{totalScenarios}</span>
                </div>
                <button
                  onClick={() => router.push("/workflows")}
                  className="text-xs text-violet-500 hover:text-violet-700 flex items-center gap-1 font-medium"
                >
                  Manage <ChevronRight size={12} />
                </button>
              </div>

              {workflows.length === 0 ? (
                <div className="px-6 py-10 flex flex-col items-center gap-2">
                  <Zap size={28} className="text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No scenarios yet</p>
                  <button
                    onClick={() => router.push("/workflows")}
                    className="mt-1 text-xs text-violet-500 hover:underline"
                  >
                    Create your first scenario →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {workflows.slice(0, 8).map(w => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/workflows/${w.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${w.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                        <span className="text-sm text-gray-700 font-medium">{w.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                          w.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}>
                          {w.is_active ? "Active" : "Inactive"}
                        </span>
                        <span className="text-[10px] text-gray-300">
                          {new Date(w.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <ArrowRight size={12} className="text-gray-200 group-hover:text-violet-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                  {workflows.length > 8 && (
                    <div className="px-6 py-3 text-center">
                      <button
                        onClick={() => router.push("/workflows")}
                        className="text-xs text-violet-500 hover:text-violet-700 font-medium"
                      >
                        View all {workflows.length} scenarios →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Plan Usage Strip (dashboard widget) ─────────────────────────────────────

const RESOURCE_META: { key: ResourceKey; label: string; icon: React.ElementType }[] = [
  { key: "scenarios", label: "Scenarios", icon: Zap },
  { key: "agents", label: "AI Agents", icon: Bot },
  { key: "tables", label: "Tables", icon: Table2 },
  { key: "connections", label: "Connections", icon: Plug2 },
  { key: "members", label: "Members", icon: Users },
];

function PlanUsageStrip({ usageData, onManage }: { usageData: UsageData; onManage: () => void }) {
  const plan = usageData.plan;
  const planColors: Record<PlanName, string> = {
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-100 text-blue-700",
    pro: "bg-violet-100 text-violet-700",
    enterprise: "bg-amber-100 text-amber-700",
    unlimited: "bg-emerald-100 text-emerald-700",
  };

  const atLimit = RESOURCE_META.some(({ key }) => {
    const limit = usageData.limits[key];
    return limit !== null && usageData.usage[key] >= limit;
  });

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${atLimit ? "border-amber-200" : "border-gray-100"}`}>
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <CreditCard size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Plan Usage</span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${planColors[plan]}`}>
            {PLAN_LABELS[plan]}
          </span>
          {atLimit && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertTriangle size={9} /> Limit reached
            </span>
          )}
        </div>
        <button
          onClick={onManage}
          className="text-xs text-violet-500 hover:text-violet-700 font-medium flex items-center gap-1"
        >
          Manage plan <ChevronRight size={12} />
        </button>
      </div>
      <div className="px-6 py-4 grid grid-cols-5 gap-4">
        {RESOURCE_META.map(({ key, label, icon: Icon }) => {
          const current = usageData.usage[key];
          const limit = usageData.limits[key];
          const pct = limit ? Math.min((current / limit) * 100, 100) : 0;
          const isAtLimit = limit !== null && current >= limit;
          const barColor = isAtLimit ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-violet-400";

          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Icon size={12} className="text-gray-400" /> {label}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${isAtLimit ? "text-red-500" : "text-gray-900"}`}>{current}</span>
                {limit === null ? (
                  <Infinity size={13} className="text-emerald-500" />
                ) : (
                  <span className="text-xs text-gray-400">/ {limit}</span>
                )}
              </div>
              {limit !== null && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subscription Panel ───────────────────────────────────────────────────────

const PLAN_PRICES: Record<PlanName, string> = {
  free: "$0",
  starter: "$19",
  pro: "$49",
  enterprise: "$199",
  unlimited: "$499",
};

const PLAN_ORDER: PlanName[] = ["free", "starter", "pro", "enterprise", "unlimited"];

const PLAN_HIGHLIGHTS: Record<PlanName, string[]> = {
  free: ["5 Scenarios", "2 AI Agents", "2 Tables", "3 Connections", "2 Members"],
  starter: ["20 Scenarios", "5 AI Agents", "10 Tables", "10 Connections", "5 Members"],
  pro: ["100 Scenarios", "20 AI Agents", "50 Tables", "50 Connections", "25 Members"],
  enterprise: ["500 Scenarios", "100 AI Agents", "200 Tables", "200 Connections", "100 Members"],
  unlimited: ["Unlimited everything", "No restrictions", "All features", "Priority support", "Dedicated infra"],
};

function SubscriptionPanel({
  usageData,
  org,
  onUpgraded,
}: {
  usageData: UsageData | null;
  org: Org | null;
  onUpgraded: (plan: string) => void;
}) {
  const [upgrading, setUpgrading] = useState<PlanName | null>(null);
  const [error, setError] = useState("");

  const currentPlan = (usageData?.plan ?? org?.plan ?? "free") as PlanName;
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);

  const handleUpgrade = async (plan: PlanName) => {
    setUpgrading(plan);
    setError("");
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to update plan"); return; }
      onUpgraded(plan);
    } finally {
      setUpgrading(null);
    }
  };

  const planColors: Record<PlanName, { badge: string; ring: string; button: string }> = {
    free: { badge: "bg-gray-100 text-gray-600", ring: "border-gray-200", button: "bg-gray-100 text-gray-600" },
    starter: { badge: "bg-blue-100 text-blue-700", ring: "border-blue-200", button: "bg-blue-600 text-white" },
    pro: { badge: "bg-violet-100 text-violet-700", ring: "border-violet-300", button: "bg-violet-600 text-white" },
    enterprise: { badge: "bg-amber-100 text-amber-700", ring: "border-amber-300", button: "bg-amber-500 text-white" },
    unlimited: { badge: "bg-emerald-100 text-emerald-700", ring: "border-emerald-300", button: "bg-emerald-600 text-white" },
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f9fc]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">Subscription</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage your plan and view resource usage</p>
      </header>

      <div className="px-8 py-6 space-y-8">
        {/* Current plan + usage */}
        {usageData && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Crown size={17} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Current Plan</p>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${planColors[currentPlan].badge}`}>
                    {PLAN_LABELS[currentPlan]}
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {PLAN_PRICES[currentPlan]}<span className="text-sm font-medium text-gray-400">/mo</span>
              </p>
            </div>

            <div className="p-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Resource Usage</p>
              <div className="grid grid-cols-2 gap-4">
                {RESOURCE_META.map(({ key, label, icon: Icon }) => {
                  const current = usageData.usage[key];
                  const limit = usageData.limits[key];
                  const pct = limit ? Math.min((current / limit) * 100, 100) : 0;
                  const isAtLimit = limit !== null && current >= limit;
                  const barColor = isAtLimit ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-violet-500";

                  return (
                    <div key={key} className={`rounded-xl border p-4 ${isAtLimit ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50/50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <Icon size={13} className="text-gray-400" /> {label}
                        </div>
                        {isAtLimit && <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">LIMIT</span>}
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className={`text-xl font-bold ${isAtLimit ? "text-red-500" : "text-gray-900"}`}>{current}</span>
                        {limit === null ? (
                          <span className="text-xs text-emerald-500 flex items-center gap-0.5"><Infinity size={11} /> unlimited</span>
                        ) : (
                          <span className="text-xs text-gray-400">of {limit}</span>
                        )}
                      </div>
                      {limit !== null && (
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

        {/* Plan cards */}
        <div>
          <p className="text-sm font-bold text-gray-900 mb-1">Available Plans</p>
          <p className="text-xs text-gray-400 mb-5">Upgrade or downgrade at any time. Changes take effect immediately.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLAN_ORDER.map((plan, idx) => {
              const isCurrent = plan === currentPlan;
              const isUpgrade = idx > currentIdx;
              const colors = planColors[plan];

              return (
                <div
                  key={plan}
                  className={`relative bg-white rounded-2xl border-2 p-5 flex flex-col transition-all ${
                    isCurrent ? `${colors.ring} shadow-md` : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>Current</span>
                    </div>
                  )}
                  {plan === "pro" && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-600 text-white">Popular</span>
                    </div>
                  )}

                  <div className="mb-3">
                    <p className="text-sm font-bold text-gray-900 capitalize">{PLAN_LABELS[plan]}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {PLAN_PRICES[plan]}
                      <span className="text-xs font-medium text-gray-400">/mo</span>
                    </p>
                  </div>

                  <ul className="space-y-1.5 flex-1 mb-4">
                    {PLAN_HIGHLIGHTS[plan].map(h => (
                      <li key={h} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Check size={11} className="text-green-500 flex-shrink-0" /> {h}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-500 bg-gray-50 rounded-xl">
                      <Check size={12} className="text-green-500" /> Active
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan)}
                      disabled={upgrading !== null}
                      className={`py-2 text-xs font-semibold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                        isUpgrade ? colors.button : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {upgrading === plan ? <Loader2 size={12} className="animate-spin" /> : null}
                      {isUpgrade ? "Upgrade" : "Downgrade"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Payment processing coming soon. Plan changes are applied instantly for now.
        </p>
      </div>
    </div>
  );
}

// ─── Org Settings Panel ───────────────────────────────────────────────────────

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney",
  "Pacific/Auckland",
];

function OrgSettings({ org, onSaved }: { org: Org | null; onSaved: (o: Org) => void }) {
  const [name, setName] = useState(org?.name ?? "");
  const [timezone, setTimezone] = useState(org?.timezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (org) { setName(org.name); setTimezone(org.timezone); }
  }, [org]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), timezone }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    onSaved(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f9fc] p-8">
      <div className="max-w-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Organization Settings</h2>
        <p className="text-sm text-gray-400 mb-6">Manage your workspace name and preferences</p>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Organization name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
              placeholder="Acme Inc."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              <Globe size={11} className="inline mr-1" />Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all bg-white"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Plan</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1 rounded-full capitalize">{org?.plan ?? "Free"}</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Saved!" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Email Configs Panel ──────────────────────────────────────────────────────

interface EmailConfig {
  id: string;
  name: string;
  provider: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
  verified: boolean;
  created_at: string;
  mailgun_domain?: string;
  mailgun_region?: string;
  smtp_host?: string;
  smtp_port?: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  resend: "Resend",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  postmark: "Postmark",
  smtp: "SMTP",
};

const PROVIDER_COLORS: Record<string, string> = {
  resend: "bg-black text-white",
  sendgrid: "bg-blue-600 text-white",
  mailgun: "bg-red-600 text-white",
  postmark: "bg-yellow-500 text-white",
  smtp: "bg-gray-600 text-white",
};

function blankForm() {
  return {
    name: "",
    provider: "resend",
    from_email: "",
    from_name: "",
    api_key: "",
    mailgun_domain: "",
    mailgun_region: "us",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_secure: true,
  };
}

function EmailConfigsPanel() {
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testTarget, setTestTarget] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/org/email-configs")
      .then(r => r.json())
      .then(d => { setConfigs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditId(null);
    setForm(blankForm());
    setErr("");
    setShowForm(true);
  }

  function openEdit(c: EmailConfig) {
    setEditId(c.id);
    setForm({
      name: c.name,
      provider: c.provider,
      from_email: c.from_email,
      from_name: c.from_name,
      api_key: "",
      mailgun_domain: c.mailgun_domain ?? "",
      mailgun_region: c.mailgun_region ?? "us",
      smtp_host: c.smtp_host ?? "",
      smtp_port: c.smtp_port ? String(c.smtp_port) : "587",
      smtp_user: "",
      smtp_pass: "",
      smtp_secure: true,
    });
    setErr("");
    setShowForm(true);
  }

  async function saveForm() {
    setSaving(true);
    setErr("");
    const body = {
      ...form,
      smtp_port: form.smtp_port ? Number(form.smtp_port) : null,
    };
    try {
      const res = editId
        ? await fetch(`/api/org/email-configs/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/org/email-configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to save"); return; }
      if (editId) {
        setConfigs(cs => cs.map(c => c.id === editId ? data : c));
      } else {
        setConfigs(cs => [...cs, data]);
      }
      setShowForm(false);
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setActivatingId(id);
    try {
      const res = await fetch(`/api/org/email-configs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "activate" }) });
      const data = await res.json();
      if (res.ok) {
        setConfigs(cs => cs.map(c => ({ ...c, is_active: c.id === id ? true : false })));
      } else {
        setErr(data.error || "Failed to activate");
      }
    } finally {
      setActivatingId(null);
    }
  }

  async function sendTest(id: string) {
    if (!testEmail.trim()) return;
    setTestingId(id);
    setErr("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res: Response;
      try {
        res = await fetch(`/api/org/email-configs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _action: "test", test_to: testEmail }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res.json();
      if (res.ok) {
        setConfigs(cs => cs.map(c => c.id === id ? { ...c, verified: true } : c));
        setTestTarget(null);
        setTestEmail("");
      } else {
        setErr(data.error || "Test failed");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setErr("Request timed out. Check your SMTP host and port.");
      } else {
        setErr("Network error");
      }
    } finally {
      setTestingId(null);
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm("Delete this email configuration?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/org/email-configs/${id}`, { method: "DELETE" });
      if (res.ok) setConfigs(cs => cs.filter(c => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f9fc]">
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Email Accounts</h1>
          <p className="text-xs text-gray-400 mt-0.5">Configure outbound email providers for your organization</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-xs font-semibold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
        >
          <Plus size={13} /> Add Provider
        </button>
      </header>

      <div className="px-8 py-6 max-w-3xl space-y-4">
        {err && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={14} /> {err}
            <button onClick={() => setErr("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700 flex items-start gap-2">
          <Mail size={13} className="mt-0.5 flex-shrink-0" />
          <span>Only one provider can be <strong>active</strong> at a time. The active provider is used for all outgoing emails from your org. If none is active, the app default (Resend) is used.</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
        ) : configs.length === 0 && !showForm ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Mail size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No email providers configured</p>
            <p className="text-xs text-gray-400 mt-1">Add a provider to send emails from your org</p>
            <button onClick={openAdd} className="mt-4 text-xs font-semibold text-violet-600 hover:text-violet-700">
              + Add your first provider
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map(c => (
              <div key={c.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${c.is_active ? "border-violet-300 ring-1 ring-violet-200" : "border-gray-100"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{c.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PROVIDER_COLORS[c.provider] ?? "bg-gray-200 text-gray-700"}`}>
                        {PROVIDER_LABELS[c.provider] ?? c.provider}
                      </span>
                      {c.is_active && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                          <Check size={9} /> Active
                        </span>
                      )}
                      {c.verified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={9} /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{c.from_name ? `${c.from_name} <${c.from_email}>` : c.from_email}</p>
                    {c.smtp_host && <p className="text-xs text-gray-400">SMTP: {c.smtp_host}:{c.smtp_port}</p>}
                    {c.mailgun_domain && <p className="text-xs text-gray-400">Domain: {c.mailgun_domain} ({c.mailgun_region === "eu" ? "EU" : "US"})</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!c.is_active && (
                      <button
                        onClick={() => activate(c.id)}
                        disabled={activatingId === c.id}
                        className="text-xs font-medium text-violet-600 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors disabled:opacity-50"
                      >
                        {activatingId === c.id ? <Loader2 size={12} className="animate-spin" /> : "Set Active"}
                      </button>
                    )}
                    <button
                      onClick={() => { setTestTarget(c.id); setTestEmail(""); setErr(""); }}
                      className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteConfig(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {/* Test email inline */}
                {testTarget === c.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <input
                      type="email"
                      placeholder="Send test to email address…"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                    />
                    <button
                      onClick={() => sendTest(c.id)}
                      disabled={testingId === c.id || !testEmail.trim()}
                      className="text-xs font-semibold bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {testingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      Send Test
                    </button>
                    <button onClick={() => setTestTarget(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-gray-900">{editId ? "Edit Email Provider" : "Add Email Provider"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Marketing Resend"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                  <select
                    value={form.provider}
                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400 bg-white"
                  >
                    {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Email</label>
                  <input
                    type="email"
                    placeholder="noreply@yourdomain.com"
                    value={form.from_email}
                    onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Name</label>
                  <input
                    type="text"
                    placeholder="Acme Notifications"
                    value={form.from_name}
                    onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              {/* Provider-specific fields */}
              {(form.provider === "resend" || form.provider === "sendgrid" || form.provider === "postmark") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder={editId ? "Leave blank to keep existing key" : "API key…"}
                    value={form.api_key}
                    onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                  />
                </div>
              )}

              {form.provider === "mailgun" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                    <input
                      type="password"
                      placeholder={editId ? "Leave blank to keep existing key" : "Mailgun API key…"}
                      value={form.api_key}
                      onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sending Domain</label>
                      <input
                        type="text"
                        placeholder="mg.yourdomain.com"
                        value={form.mailgun_domain}
                        onChange={e => setForm(f => ({ ...f, mailgun_domain: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                      <select
                        value={form.mailgun_region}
                        onChange={e => setForm(f => ({ ...f, mailgun_region: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400 bg-white"
                      >
                        <option value="us">US</option>
                        <option value="eu">EU</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.provider === "smtp" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.yourdomain.com"
                        value={form.smtp_host}
                        onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={form.smtp_port}
                        onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                      <input
                        type="text"
                        placeholder="SMTP username"
                        value={form.smtp_user}
                        onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                      <input
                        type="password"
                        placeholder={editId ? "Leave blank to keep existing" : "SMTP password"}
                        value={form.smtp_pass}
                        onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.smtp_secure}
                      onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked }))}
                      className="rounded"
                    />
                    Use TLS/SSL
                  </label>
                </div>
              )}

              {err && <p className="text-xs text-red-500">{err}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={saveForm}
                  disabled={saving}
                  className="text-xs font-semibold bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {editId ? "Save Changes" : "Add Provider"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Org Sidebar ──────────────────────────────────────────────────────────────

function OrgSidebar({
  activeNav,
  setActiveNav,
  org,
}: {
  activeNav: string;
  setActiveNav: (id: string) => void;
  org: Org | null;
}) {
  const initials = org?.name
    ? org.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "…";

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-4 flex-shrink-0 overflow-y-auto">
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{org?.name ?? "Loading…"}</p>
            <p className="text-[9px] text-gray-400 capitalize">{org?.plan ?? "Free"} plan</p>
          </div>
        </div>
      </div>

      {ORG_NAV.map(({ section, items }) => (
        <div key={section} className="mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-5 mb-1.5">{section}</p>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                activeNav === id
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon size={14} className={activeNav === id ? "text-violet-600" : "text-gray-400"} />
              <span className="text-xs font-medium">{label}</span>
              {activeNav === id && <ChevronRight size={11} className="ml-auto text-violet-400" />}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
