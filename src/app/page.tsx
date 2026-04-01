"use client";

import Link from "next/link";
import {
  Zap, ArrowRight, GitBranch, Bot, Globe, Table2,
  Shield, Plug, FileText, PenLine, Server, Lock,
  CheckCircle, ChevronRight, Layers, Cpu,
} from "lucide-react";

/* ─── Data ──────────────────────────────────────────────────── */

const CORE = [
  {
    icon: GitBranch,
    color: "#7c3aed",
    title: "Visual Workflow Builder",
    desc: "Design automations on a drag-and-drop canvas. Branch logic, loop over data, and chain hundreds of steps — all without writing code.",
  },
  {
    icon: Bot,
    color: "#ec4899",
    title: "AI Agents",
    desc: "Embed GPT-4, Claude, or Gemini directly into your flows. Build chat agents that respond, decide, and take action.",
  },
  {
    icon: Globe,
    color: "#38bdf8",
    title: "Webhooks & APIs",
    desc: "Trigger workflows from any HTTP event and return real-time responses. Turn any flow into a live API endpoint.",
  },
  {
    icon: Table2,
    color: "#10b981",
    title: "Built-in Data Store",
    desc: "Create managed tables, query rows, and update records — a lightweight database living right inside your workspace.",
  },
  {
    icon: Lock,
    color: "#f97316",
    title: "Secrets Manager",
    desc: "Store API keys, tokens, and credentials in an encrypted vault. Reference them in any node without ever exposing values.",
  },
  {
    icon: Plug,
    color: "#8b5cf6",
    title: "100+ Integrations",
    desc: "Slack, Notion, HubSpot, Stripe, GitHub, Gmail, Airtable and dozens more — pre-built connections ready to use.",
  },
];

const ADVANCED = [
  {
    icon: Server,
    color: "#7c3aed",
    title: "MCP Toolbox",
    desc: "Host your own Model Context Protocol server. Expose workflows as AI tools and let any MCP client — Cline, Claude Desktop — call them directly.",
    badge: "New",
  },
  {
    icon: FileText,
    color: "#0ea5e9",
    title: "Doc Composer",
    desc: "Merge data into Word templates and generate polished PDF or DOCX files on the fly. Loops, conditionals, image fields — all supported.",
    badge: "New",
  },
  {
    icon: PenLine,
    color: "#10b981",
    title: "E-Sign Documents",
    desc: "Send documents for signature via API or workflow. Track status, receive callbacks, and automate post-sign actions automatically.",
    badge: null,
  },
];

const HOW = [
  { step: "1", title: "Build your workflow", desc: "Connect triggers, actions, AI nodes, and logic on the visual canvas." },
  { step: "2", title: "Connect your tools", desc: "Link your existing apps, databases, or expose a webhook endpoint in seconds." },
  { step: "3", title: "Ship and scale", desc: "Activate the scenario. Every trigger runs it automatically — no servers to manage." },
];

const STATS = [
  { value: "100+", label: "Integrations" },
  { value: "10+", label: "Node types" },
  { value: "3", label: "AI providers" },
  { value: "∞", label: "Automations" },
];

/* ─── Component ─────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080612] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">FlowMake</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#advanced" className="hover:text-white transition-colors">Advanced</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white px-4 py-2 rounded-lg transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="text-center px-6 pt-20 pb-28 max-w-5xl mx-auto relative">
        {/* glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #7c3aed 0%, #ec4899 50%, transparent 70%)" }}
        />

        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
          Automation · AI Agents · MCP Servers · E-Sign
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
          One platform to
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #a78bfa, #ec4899, #38bdf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            automate everything
          </span>
        </h1>

        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Build visual workflows, deploy AI agents, generate documents, collect e-signatures,
          and host your own MCP servers — all from a single workspace.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap mb-16">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-violet-900/30"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white/70 border border-white/10 hover:bg-white/5 transition-all"
          >
            Sign in <ChevronRight size={16} />
          </Link>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs text-violet-400 font-semibold uppercase tracking-widest mb-3">
            <Layers size={12} /> Core Platform
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything you need to automate</h2>
          <p className="text-white/40 text-sm max-w-xl mx-auto">
            From simple two-step integrations to complex multi-branch AI pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CORE.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: f.color + "22" }}
              >
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Advanced Features ── */}
      <section id="advanced" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs text-pink-400 font-semibold uppercase tracking-widest mb-3">
            <Cpu size={12} /> Advanced Capabilities
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Beyond basic automation</h2>
          <p className="text-white/40 text-sm max-w-xl mx-auto">
            Powerful tools that handle the workflows most platforms can&apos;t.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ADVANCED.map((f) => (
            <div
              key={f.title}
              className="relative bg-white/[0.03] border border-white/[0.07] rounded-2xl p-7 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              {f.badge && (
                <span
                  className="absolute top-5 right-5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: f.color + "33", color: f.color }}
                >
                  {f.badge}
                </span>
              )}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ backgroundColor: f.color + "22" }}
              >
                <f.icon size={22} style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-base mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-semibold uppercase tracking-widest mb-3">
            <Zap size={12} /> How It Works
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Up and running in minutes</h2>
          <p className="text-white/40 text-sm">No infrastructure. No maintenance. Just build.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW.map((h) => (
            <div key={h.step} className="flex flex-col items-center text-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold"
                style={{ background: "linear-gradient(135deg, #7c3aed33, #ec4899333)", border: "1px solid #7c3aed55" }}
              >
                {h.step}
              </div>
              <h3 className="font-bold text-sm">{h.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="max-w-4xl mx-auto px-6 pb-28">
        <div
          className="rounded-3xl border border-white/10 p-10 md:p-14 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7c3aed0d, #ec48990d, #38bdf80d)" }}
        >
          <div
            className="absolute inset-0 opacity-10 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, #7c3aed 0%, transparent 70%)" }}
          />
          <Shield size={32} className="text-violet-400 mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Your data. Your org. Your rules.
          </h2>
          <p className="text-white/40 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
            Full multi-tenant isolation — every workspace is siloed. Secrets are encrypted,
            connections are scoped to your org, and you control who has access.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-white/50">
            {["Org-level isolation", "Encrypted secrets", "Role-based access", "API key auth", "Audit logs"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <CheckCircle size={11} className="text-green-400" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="text-center px-6 py-24 border-t border-white/5 relative">
        <div
          className="absolute inset-0 opacity-10 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center bottom, #ec4899 0%, transparent 60%)" }}
        />
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
          Ready to build?
        </h2>
        <p className="text-white/40 text-sm mb-10 max-w-sm mx-auto">
          Free to start. No credit card required. Cancel anytime.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 px-9 py-4 rounded-xl font-bold text-base text-white transition-all hover:opacity-90 hover:scale-105 shadow-xl shadow-violet-900/40"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}
        >
          Create your free account <ArrowRight size={18} />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}
            >
              <Zap size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">FlowMake</span>
          </div>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} FlowMake. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-white/30">
            <Link href="/auth/login" className="hover:text-white/60 transition-colors">Sign in</Link>
            <Link href="/auth/signup" className="hover:text-white/60 transition-colors">Sign up</Link>
            <Link href="/help" className="hover:text-white/60 transition-colors">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
