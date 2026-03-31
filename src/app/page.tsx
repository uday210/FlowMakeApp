"use client";

import Link from "next/link";
import { Zap, ArrowRight, GitBranch, Bot, Globe, Table2, Shield, Plug } from "lucide-react";

const FEATURES = [
  { icon: GitBranch, title: "Visual Workflow Builder", desc: "Drag-and-drop automation canvas. Connect triggers, actions and logic visually.", color: "#7c3aed" },
  { icon: Bot, title: "AI Agents", desc: "Build and deploy AI chatbots powered by GPT-4, Claude, Gemini and more.", color: "#ec4899" },
  { icon: Globe, title: "Webhooks & APIs", desc: "Trigger flows from any HTTP event. Return custom responses in real time.", color: "#38bdf8" },
  { icon: Table2, title: "Built-in Database", desc: "Store, query and update data in your own managed tables — no extra setup.", color: "#10b981" },
  { icon: Shield, title: "E-Sign Documents", desc: "Send contracts for signature. Track status and automate follow-ups.", color: "#f59e0b" },
  { icon: Plug, title: "100+ Integrations", desc: "Slack, Notion, HubSpot, Stripe, GitHub, Gmail and many more out of the box.", color: "#8b5cf6" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0618] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}>
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">FlowMake</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white px-4 py-2 rounded-lg transition-colors">
            Sign in
          </Link>
          <Link href="/auth/signup" className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Now live — automate anything
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
          Automate your work
          <br />
          <span style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            visually, like Make.com
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Build powerful automations with a drag-and-drop canvas. Connect AI agents, webhooks, databases and 100+ apps — no code required.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/auth/signup"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105 shadow-lg"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <Link href="/auth/login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white/70 border border-white/10 hover:bg-white/5 transition-all">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Everything you need to automate</h2>
          <p className="text-white/40 text-sm">One platform, infinite possibilities</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:bg-white/[0.06] transition-all group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: f.color + "22" }}>
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl font-bold mb-4">Ready to automate?</h2>
        <p className="text-white/40 text-sm mb-8">Free to start. No credit card required.</p>
        <Link href="/auth/signup"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899, #38bdf8)" }}
        >
          Create your free account <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-white/5 text-xs text-white/20">
        © {new Date().getFullYear()} FlowMake. All rights reserved.
      </footer>
    </div>
  );
}
