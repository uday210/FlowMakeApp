"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  LayoutDashboard, Users, UserCircle, CreditCard, BarChart2,
  Receipt, Puzzle, Variable, Settings2, Bell, Bot,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, Zap, Sparkles, ChevronRight, RefreshCw,
  Activity,
} from "lucide-react";
import type { Execution } from "@/lib/types";

// ─── Left Sidebar Nav ─────────────────────────────────────────────────────────

const ORG_NAV = [
  {
    section: "Organization",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
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
      { id: "scenario-props", label: "Scenario properties", icon: Settings2 },
      { id: "notifications", label: "Notification options", icon: Bell },
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

export default function OrgDashboard() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate deterministic 30-day sparkline data (no Math.random — avoids hydration mismatch)
  const dailyUsageData = Array.from({ length: 30 }, (_, i) =>
    Math.max(0, Math.round(Math.sin(i * 0.4) * 3 + Math.abs(Math.sin(i * 1.3)) * 4))
  );

  useEffect(() => {
    // Load scenarios
    fetch("/api/workflows")
      .then(r => r.json())
      .then(d => setWorkflows(Array.isArray(d) ? d : []))
      .catch(() => {});

    // Load recent executions across all workflows
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

  if (activeNav !== "dashboard") {
    return (
      <AppShell>
        <div className="flex h-full">
          <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">This section is coming soon.</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Left org sidebar */}
        <OrgSidebar activeNav={activeNav} setActiveNav={setActiveNav} />

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
                onClick={() => router.push("/")}
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
                  onClick={() => router.push("/")}
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
                    onClick={() => router.push("/")}
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
                  onClick={() => router.push("/")}
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
                    onClick={() => router.push("/")}
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
                        onClick={() => router.push("/")}
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

// ─── Org Sidebar ──────────────────────────────────────────────────────────────

function OrgSidebar({
  activeNav,
  setActiveNav,
}: {
  activeNav: string;
  setActiveNav: (id: string) => void;
}) {
  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-4 flex-shrink-0 overflow-y-auto">
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
          <div className="w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-white">MY</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">My Organization</p>
            <p className="text-[9px] text-gray-400">Free plan</p>
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
