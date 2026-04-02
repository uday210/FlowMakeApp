"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import {
  Building2, Users, Zap, RefreshCw, Shield, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Trash2, PenLine, Check, X, Loader2,
  Bot, Table2, AlertTriangle, Mail, Crown, UserX, Infinity,
  KeyRound, Plug2, Plus, Eye, EyeOff, Send,
} from "lucide-react";
import { PLAN_LIMITS, PLAN_LABELS, RESOURCE_LABELS, type PlanName, type ResourceKey } from "@/lib/plan-limits";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  timezone: string;
  member_count: number;
  workflow_count: number;
  agent_count: number;
  table_count: number;
};

type OrgDetail = {
  org: Org;
  members: { id: string; full_name: string; role: string; created_at: string }[];
  workflows: { id: string; name: string; is_active: boolean; created_at: string }[];
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  org_id: string;
  org_name: string | null;
  org_active: boolean;
  created_at: string;
};

const PLANS: PlanName[] = ["free", "starter", "pro", "enterprise", "unlimited"];

const PLAN_COLORS: Record<PlanName, string> = {
  free: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
  unlimited: "bg-emerald-100 text-emerald-700",
};

// ─── Shared modal shell ───────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Create Org modal ─────────────────────────────────────────────────────────

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (org: Org) => void }) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<PlanName>("free");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), plan }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create org"); return; }
      onCreated(json);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create Organization" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Organization Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Acme Corp"
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plan</label>
          <select
            value={plan}
            onChange={e => setPlan(e.target.value as PlanName)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white"
          >
            {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Organization
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create / Invite User modal ───────────────────────────────────────────────

function CreateUserModal({
  onClose,
  onCreated,
  orgs,
  defaultOrgId,
  defaultRole,
  title,
}: {
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
  orgs: Org[];
  defaultOrgId?: string;
  defaultRole?: string;
  title: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole ?? "member");
  const [orgId, setOrgId] = useState(defaultOrgId ?? "");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          full_name: fullName.trim() || undefined,
          role,
          org_id: orgId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create user"); return; }
      const org = orgs.find(o => o.id === orgId);
      onCreated({
        ...json,
        org_name: org?.name ?? null,
        org_active: org?.is_active ?? true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = role === "superadmin";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name</label>
          <input
            autoFocus
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email <span className="text-red-400">*</span></label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password <span className="text-red-400">*</span></label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white"
          >
            <option value="member">Member</option>
            <option value="admin">Org Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        {!isSuperAdmin && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Organization</label>
            <select
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-violet-400 bg-white"
            >
              <option value="">— No organization —</option>
              {orgs.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({PLAN_LABELS[(o.plan as PlanName) ?? "free"]})</option>
              ))}
            </select>
          </div>
        )}
        {isSuperAdmin && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Super Admins have platform-wide access and are not assigned to any organization.
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={saving || !email.trim() || !password.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create User
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({ current, limit, label }: { current: number; limit: number | null; label: string }) {
  if (limit === null) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <span className="text-gray-400">{label}:</span>
        <span className="font-medium text-emerald-600">{current}</span>
        <Infinity size={9} className="text-emerald-500" />
      </div>
    );
  }
  const pct = Math.min((current / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-violet-400";
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-gray-400 w-14 truncate">{label}</span>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-medium tabular-nums ${pct >= 90 ? "text-red-500" : "text-gray-600"}`}>
        {current}/{limit}
      </span>
    </div>
  );
}

// ─── Inline edit ──────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!val.trim() || val === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(val.trim()); setEditing(false); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
          className="text-sm font-semibold border border-violet-400 rounded-lg px-2 py-0.5 outline-none w-44"
        />
        <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-700">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => { setVal(value); setEditing(false); }} className="text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 group/edit cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
      <PenLine size={11} className="text-gray-300 group-hover/edit:text-violet-400 transition-colors" />
    </span>
  );
}

// ─── Org row ──────────────────────────────────────────────────────────────────

function OrgRow({ org, orgs, onUpdate, onDelete, onUserCreated }: {
  org: Org;
  orgs: Org[];
  onUpdate: (id: string, changes: Partial<Org>) => Promise<void>;
  onDelete: (id: string) => void;
  onUserCreated: (u: UserProfile) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planChanging, setPlanChanging] = useState(false);
  const [addMember, setAddMember] = useState(false);

  const plan = (org.plan ?? "free") as PlanName;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const loadDetail = async () => {
    if (detail) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`);
      if (res.ok) setDetail(await res.json());
    } finally { setLoadingDetail(false); }
  };

  const toggleActive = async () => {
    setToggling(true);
    try { await onUpdate(org.id, { is_active: !org.is_active }); } finally { setToggling(false); }
  };

  const changePlan = async (p: string) => {
    setPlanChanging(true);
    try { await onUpdate(org.id, { plan: p }); } finally { setPlanChanging(false); }
  };

  return (
    <>
      <tr className={`border-b border-gray-100 transition-colors ${org.is_active ? "hover:bg-gray-50/50" : "bg-red-50/30 hover:bg-red-50/50"}`}>
        <td className="px-3 py-3 w-8">
          <button onClick={() => { setExpanded(e => !e); if (!expanded) loadDetail(); }} className="p-0.5 text-gray-400 hover:text-gray-700">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-3 py-3">
          <InlineEdit value={org.name} onSave={name => onUpdate(org.id, { name })} />
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{org.slug}</p>
        </td>
        <td className="px-3 py-3">
          <button
            onClick={toggleActive} disabled={toggling}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${org.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
          >
            {toggling ? <Loader2 size={11} className="animate-spin" /> : org.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {org.is_active ? "Active" : "Disabled"}
          </button>
        </td>
        <td className="px-3 py-3">
          <select
            value={plan} onChange={e => changePlan(e.target.value)} disabled={planChanging}
            className={`text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-violet-400 font-semibold capitalize ${PLAN_COLORS[plan]}`}
          >
            {PLANS.map(p => <option key={p} value={p} className="capitalize bg-white text-gray-800">{PLAN_LABELS[p]}</option>)}
          </select>
        </td>
        <td className="px-3 py-3">
          <div className="space-y-1">
            <UsageBar current={org.workflow_count} limit={limits.scenarios} label="Scenarios" />
            <UsageBar current={org.agent_count} limit={limits.agents} label="Agents" />
            <UsageBar current={org.table_count} limit={limits.tables} label="Tables" />
            <div className="text-[10px] text-gray-400 flex items-center gap-1"><Users size={9} /> {org.member_count} member{org.member_count !== 1 ? "s" : ""}</div>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
          {new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </td>
        <td className="px-3 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-red-500 font-medium">Sure?</span>
              <button onClick={() => onDelete(org.id)} className="text-red-500 hover:text-red-700 p-0.5"><Check size={13} /></button>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-400 p-0.5"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-all">
              <Trash2 size={13} />
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/80">
          <td colSpan={7} className="px-6 py-4">
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : detail ? (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={11} /> Members ({detail.members.length})
                    </p>
                    <button
                      onClick={() => setAddMember(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                    >
                      <Plus size={11} /> Add Member
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {detail.members.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No members yet</p>
                    ) : detail.members.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-700">{m.full_name || "(no name)"}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>
                          {m.role ?? "member"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Zap size={11} /> Recent Scenarios ({detail.workflows.length})
                  </p>
                  <div className="space-y-1.5">
                    {detail.workflows.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No scenarios</p>
                    ) : detail.workflows.slice(0, 8).map(wf => (
                      <div key={wf.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-700 truncate flex-1">{wf.name}</span>
                        <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${wf.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {wf.is_active ? "on" : "off"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400">Failed to load details</p>
            )}
          </td>
        </tr>
      )}

      {addMember && (
        <CreateUserModal
          title={`Add Member to ${org.name}`}
          onClose={() => setAddMember(false)}
          orgs={orgs}
          defaultOrgId={org.id}
          defaultRole="member"
          onCreated={u => {
            onUserCreated(u);
            if (detail) {
              setDetail(prev => prev ? {
                ...prev,
                members: [...prev.members, { id: u.id, full_name: u.full_name, role: u.role, created_at: new Date().toISOString() }]
              } : null);
            }
          }}
        />
      )}
    </>
  );
}

// ─── Plans tab ────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<ResourceKey, React.ElementType> = {
  scenarios: Zap, agents: Bot, tables: Table2,
  connections: Plug2, secrets: KeyRound, members: Users,
};

function PlansTab() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">Plan Limits Reference</h2>
        <p className="text-xs text-gray-400 mt-0.5">These limits are enforced automatically when orgs create resources.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Resource</th>
              {PLANS.map(p => (
                <th key={p} className="text-center px-4 py-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${PLAN_COLORS[p]}`}>{PLAN_LABELS[p]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(Object.keys(RESOURCE_LABELS) as ResourceKey[]).map(resource => {
              const Icon = RESOURCE_ICONS[resource];
              return (
                <tr key={resource} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <Icon size={13} className="text-gray-400" /> {RESOURCE_LABELS[resource]}
                    </div>
                  </td>
                  {PLANS.map(plan => {
                    const limit = PLAN_LIMITS[plan][resource];
                    return (
                      <td key={plan} className="text-center px-4 py-3">
                        {limit === null
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50"><Infinity size={14} className="text-emerald-500" /></span>
                          : <span className="text-sm font-bold text-gray-700">{limit}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Super Admins tab ─────────────────────────────────────────────────────────

function SuperAdminsTab({ users, orgs, onUserCreated }: { users: UserProfile[]; orgs: Org[]; onUserCreated: (u: UserProfile) => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const superAdmins = users.filter(u => u.role === "superadmin");

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Super Admins</h2>
          <p className="text-xs text-gray-400 mt-0.5">Platform-level administrators with full access.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-xl transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
        >
          <Plus size={13} /> Add Super Admin
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {superAdmins.length === 0 ? (
            <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400 text-sm">No super admins found</td></tr>
          ) : superAdmins.map(u => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700">
                    {(u.full_name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{u.full_name || "(no name)"}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">superadmin</span>
                </div>
              </td>
              <td className="px-5 py-3 text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                <Mail size={11} className="text-gray-300" /> {u.email}
              </td>
              <td className="px-5 py-3 text-xs text-gray-400">
                {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <CreateUserModal
          title="Add Super Admin"
          onClose={() => setShowCreate(false)}
          orgs={orgs}
          defaultRole="superadmin"
          onCreated={onUserCreated}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Platform Email Tab ───────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "resend",    label: "Resend" },
  { value: "sendgrid",  label: "SendGrid" },
  { value: "mailgun",   label: "Mailgun" },
  { value: "postmark",  label: "Postmark" },
  { value: "smtp",      label: "SMTP" },
  { value: "mailtrap",  label: "Mailtrap" },
];

function PlatformEmailTab() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showPass, setShowPass] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch("/api/admin/platform-email")
      .then(r => r.json())
      .then(d => {
        setConfig({
          provider:       d.email_provider ?? "",
          from_email:     d.email_from ?? "",
          from_name:      d.email_from_name ?? "",
          mailgun_domain: d.email_mailgun_domain ?? "",
          mailgun_region: d.email_mailgun_region ?? "us",
          smtp_host:      d.email_smtp_host ?? "",
          smtp_port:      String(d.email_smtp_port ?? "587"),
          smtp_user:      d.email_smtp_user ?? "",
          smtp_secure:    String(d.email_smtp_secure ?? "true"),
          mailtrap_inbox_id: d.email_mailtrap_inbox_id ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setConfig(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/platform-email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider:         config.provider || null,
        from_email:       config.from_email,
        from_name:        config.from_name,
        api_key:          config.api_key,
        mailgun_domain:   config.mailgun_domain,
        mailgun_region:   config.mailgun_region,
        smtp_host:        config.smtp_host,
        smtp_port:        config.smtp_port ? parseInt(config.smtp_port) : null,
        smtp_user:        config.smtp_user,
        smtp_pass:        config.smtp_pass,
        smtp_secure:      config.smtp_secure === "true",
        mailtrap_inbox_id: config.mailtrap_inbox_id,
      }),
    });
    setSaving(false);
    showToast(res.ok ? "Saved successfully" : "Failed to save", res.ok);
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    const res = await fetch("/api/admin/platform-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail.trim() }),
    });
    setTesting(false);
    const d = await res.json();
    showToast(res.ok ? `Test email sent to ${testEmail}` : (d.error ?? "Failed"), res.ok);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={24} /></div>;

  const provider = config.provider;
  const needsApiKey = ["resend", "sendgrid", "postmark", "mailgun", "mailtrap"].includes(provider);
  const isMailgun = provider === "mailgun";
  const isSmtp = provider === "smtp";
  const isMailtrap = provider === "mailtrap";

  return (
    <div className="max-w-2xl space-y-6">
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${toast.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Platform Email</h3>
          <p className="text-xs text-gray-400 mt-0.5">Used as fallback when an org has no email provider configured.</p>
        </div>

        {/* Provider */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Provider</label>
          <select value={provider} onChange={e => set("provider", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
            <option value="">— Select provider —</option>
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {provider && (
          <>
            {/* From fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">From Email</label>
                <input value={config.from_email} onChange={e => set("from_email", e.target.value)}
                  placeholder="noreply@yourapp.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">From Name</label>
                <input value={config.from_name} onChange={e => set("from_name", e.target.value)}
                  placeholder="FlowMake"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
            </div>

            {/* API Key */}
            {needsApiKey && (
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  {isMailtrap ? "Mailtrap API Token" : `${PROVIDERS.find(p => p.value === provider)?.label} API Key`}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={config.api_key ?? ""}
                    onChange={e => set("api_key", e.target.value)}
                    placeholder="Leave blank to keep existing key"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* Mailgun extras */}
            {isMailgun && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Mailgun Domain</label>
                  <input value={config.mailgun_domain} onChange={e => set("mailgun_domain", e.target.value)}
                    placeholder="mg.yourapp.com"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Region</label>
                  <select value={config.mailgun_region} onChange={e => set("mailgun_region", e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-violet-400">
                    <option value="us">US</option>
                    <option value="eu">EU</option>
                  </select>
                </div>
              </div>
            )}

            {/* Mailtrap inbox ID */}
            {isMailtrap && (
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Inbox ID (optional — for sandbox)</label>
                <input value={config.mailtrap_inbox_id} onChange={e => set("mailtrap_inbox_id", e.target.value)}
                  placeholder="Leave blank for production sending"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
            )}

            {/* SMTP fields */}
            {isSmtp && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">SMTP Host</label>
                    <input value={config.smtp_host} onChange={e => set("smtp_host", e.target.value)}
                      placeholder="smtp.yourprovider.com"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Port</label>
                    <input value={config.smtp_port} onChange={e => set("smtp_port", e.target.value)}
                      placeholder="587"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">SMTP Username</label>
                    <input value={config.smtp_user} onChange={e => set("smtp_user", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">SMTP Password</label>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={config.smtp_pass ?? ""}
                        onChange={e => set("smtp_pass", e.target.value)}
                        placeholder="Leave blank to keep existing"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="smtp_secure" checked={config.smtp_secure === "true"}
                    onChange={e => set("smtp_secure", String(e.target.checked))}
                    className="rounded" />
                  <label htmlFor="smtp_secure" className="text-xs text-gray-600">Use TLS/SSL</label>
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save Configuration
        </button>
      </div>

      {/* Test send */}
      {config.provider && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Send Test Email</h3>
          <p className="text-xs text-gray-400 mb-4">Verify your platform email config by sending a test message.</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendTest()}
              placeholder="Enter email address"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <button onClick={sendTest} disabled={testing || !testEmail.trim()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orgs" | "users" | "superadmins" | "plans" | "platform-email">("orgs");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const loadData = useCallback(async () => {
    const [orgsRes, usersRes] = await Promise.all([fetch("/api/admin/orgs"), fetch("/api/admin/users")]);
    if (orgsRes.ok) setOrgs(await orgsRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const ok = profile?.role === "superadmin";
      setIsAdmin(ok);
      if (ok) await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const handleUpdate = async (id: string, changes: Partial<Org>) => {
    const res = await fetch(`/api/admin/orgs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    if (res.ok) { const updated = await res.json(); setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o)); }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/orgs/${id}`, { method: "DELETE" });
    if (res.ok) { setOrgs(prev => prev.filter(o => o.id !== id)); setUsers(prev => prev.filter(u => u.org_id !== id)); }
  };

  const handleUserCreated = (u: UserProfile) => setUsers(prev => [u, ...prev]);
  const handleOrgCreated = (o: Org) => setOrgs(prev => [o, ...prev]);

  const filteredOrgs = orgs.filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter(u => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.org_name?.toLowerCase().includes(search.toLowerCase()));

  const activeOrgs = orgs.filter(o => o.is_active).length;
  const disabledOrgs = orgs.length - activeOrgs;
  const planCounts = PLANS.reduce((acc, p) => { acc[p] = orgs.filter(o => (o.plan ?? "free") === p).length; return acc; }, {} as Record<string, number>);

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading…
      </div>
    </AppShell>
  );

  if (!isAdmin) return (
    <AppShell>
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Shield size={48} className="text-gray-300" />
        <p className="text-base font-semibold text-gray-500">Admin access required</p>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
                <Crown size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Global Admin</h1>
                <p className="text-xs text-gray-400">Full platform control — organizations, users, and plans</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-xl hover:opacity-90 transition-all"
                style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
              >
                <Plus size={13} /> New User
              </button>
              <button
                onClick={() => setShowCreateOrg(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-xl hover:opacity-90 transition-all"
                style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
              >
                <Building2 size={13} /> New Org
              </button>
              <button onClick={() => loadData()} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Total Orgs", value: orgs.length, icon: Building2, color: "violet" },
              { label: "Active", value: activeOrgs, icon: ToggleRight, color: "green" },
              { label: "Disabled", value: disabledOrgs, icon: ToggleLeft, color: "red" },
              { label: "Total Users", value: users.length, icon: Users, color: "blue" },
              { label: "Super Admins", value: users.filter(u => u.role === "superadmin").length, icon: Crown, color: "amber" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-${color}-50 border border-${color}-100`}>
                    <Icon size={15} className={`text-${color}-600`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{value}</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Plan distribution */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plan Distribution</p>
            <div className="flex gap-3 flex-wrap">
              {PLANS.map(p => (
                <div key={p} className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[p]}`}>{PLAN_LABELS[p]}</span>
                  <span className="text-sm font-bold text-gray-700">{planCounts[p] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {([
                { key: "orgs", label: `Organizations (${orgs.length})` },
                { key: "users", label: `All Users (${users.length})` },
                { key: "superadmins", label: `Super Admins (${users.filter(u => u.role === "superadmin").length})` },
                { key: "plans", label: "Plans & Limits" },
                { key: "platform-email", label: "Platform Email" },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  {label}
                </button>
              ))}
            </div>
            {(tab === "orgs" || tab === "users") && (
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="flex-1 max-w-xs text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white"
              />
            )}
          </div>

          {/* Orgs Table */}
          {tab === "orgs" && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {disabledOrgs > 0 && (
                <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                  <AlertTriangle size={13} />
                  <span>{disabledOrgs} organization{disabledOrgs > 1 ? "s are" : " is"} currently disabled.</span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-8 px-3 py-3" />
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usage vs Limit</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">No organizations found</td></tr>
                  ) : filteredOrgs.map(org => (
                    <OrgRow key={org.id} org={org} orgs={orgs} onUpdate={handleUpdate} onDelete={handleDelete} onUserCreated={handleUserCreated} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All Users Table */}
          {tab === "users" && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">No users found</td></tr>
                  ) : filteredUsers.map(u => {
                    const userOrg = orgs.find(o => o.id === u.org_id);
                    const orgPlan = (userOrg?.plan ?? "free") as PlanName;
                    return (
                      <tr key={u.id} className={`hover:bg-gray-50 ${!u.org_active ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-700 flex-shrink-0">
                              {(u.full_name || u.email || "?")[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900 text-xs">{u.full_name || "(no name)"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5"><Mail size={11} className="text-gray-300" />{u.email || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.org_name ? (
                            <span className="flex items-center gap-1.5">{u.org_name}{!u.org_active && <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium"><UserX size={10} />disabled</span>}</span>
                          ) : <span className="text-gray-400 italic">No org</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u.org_id ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[orgPlan]}`}>{PLAN_LABELS[orgPlan]}</span> : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${u.role === "admin" ? "bg-violet-100 text-violet-700" : u.role === "superadmin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                            {u.role ?? "member"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "superadmins" && <SuperAdminsTab users={users} orgs={orgs} onUserCreated={handleUserCreated} />}
          {tab === "plans" && <PlansTab />}
          {tab === "platform-email" && <PlatformEmailTab />}
        </div>
      </div>

      {showCreateOrg && <CreateOrgModal onClose={() => setShowCreateOrg(false)} onCreated={handleOrgCreated} />}
      {showCreateUser && (
        <CreateUserModal
          title="Create New User"
          onClose={() => setShowCreateUser(false)}
          orgs={orgs}
          onCreated={handleUserCreated}
        />
      )}
    </AppShell>
  );
}
