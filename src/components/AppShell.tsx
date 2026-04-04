"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavigationProgress, { startNavProgress } from "@/components/NavigationProgress";
import { useTour } from "@/components/AppTour";
import { PAGE_TOURS } from "@/lib/tours";
import {
  Zap,
  LayoutTemplate,
  Shield,
  Globe,
  Database,
  KeyRound,
  Plug,
  FileText,
  Home,
  HelpCircle,
  Building2,
  Table2,
  Bot,
  LogOut,
  Crown,
  Mail,
  BarChart2,
  ClipboardList,
  Sun,
  Moon,
  ChevronDown,
  Phone,
} from "lucide-react";
import { useTheme } from "next-themes";

// ── Nav structure ─────────────────────────────────────────────────────────────

const USER_NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { href: "/org",       icon: Building2, label: "Organization" },
      { href: "/workflows", icon: Home,       label: "Scenarios" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/tables",     icon: Table2,   label: "My Tables" },
      { href: "/datastores", icon: Database, label: "Data Stores" },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/agents",        icon: Bot,   label: "AI Agents" },
      { href: "/voice-agents",  icon: Phone, label: "Voice Agents" },
      { href: "/mcp",           icon: Plug,  label: "MCP Toolboxes" },
      { href: "/webhooks",      icon: Globe, label: "Webhooks" },
    ],
  },
  {
    label: "Credentials",
    items: [
      { href: "/connections", icon: Shield,  label: "Credentials" },
      { href: "/secrets",     icon: KeyRound, label: "Secrets" },
      { href: "/api-keys",    icon: KeyRound, label: "API Keys" },
    ],
  },
  {
    label: "Documents",
    items: [
      { href: "/documents",       icon: FileText,     label: "E-Sign" },
      { href: "/doc-templates",   icon: LayoutTemplate, label: "Doc Composer" },
      { href: "/email-templates", icon: Mail,         label: "Email Templates" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics",     icon: BarChart2,    label: "Analytics" },
      { href: "/web-analytics", icon: Globe,        label: "Web Analytics" },
      { href: "/settings/activity", icon: ClipboardList, label: "Activity Log" },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/help", icon: HelpCircle, label: "Help & Docs" },
    ],
  },
];

const ADMIN_NAV_SECTIONS = [
  {
    label: "Admin",
    items: [
      { href: "/admin", icon: Crown,     label: "Admin Panel" },
      { href: "/help",  icon: HelpCircle, label: "Help & Docs" },
    ],
  },
];

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { startTour } = useTour();
  const [userInitial, setUserInitial] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name ?? user.email ?? "";
        setUserInitial(name.charAt(0).toUpperCase());
        setUserEmail(user.email ?? "");
        setUserName(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsSuperAdmin(profile?.role === "superadmin");
      }
      setRoleLoaded(true);
    });
  }, []);

  const navigate = (href: string) => {
    if (pathname !== href) {
      startNavProgress();
      router.push(href);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const sections = roleLoaded
    ? (isSuperAdmin ? ADMIN_NAV_SECTIONS : USER_NAV_SECTIONS)
    : [];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <NavigationProgress />

      {/* ── Sidebar ── */}
      <aside className="w-52 bg-[#1a0a2e] flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 flex-shrink-0 border-b border-white/10">
          <button
            onClick={() => navigate(isSuperAdmin ? "/admin" : "/workflows")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Zap size={15} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">FlowMake</span>
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-3 space-y-5"
          style={{ scrollbarWidth: "none" }}
        >
          <style>{`nav::-webkit-scrollbar { display: none; }`}</style>

          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 px-2 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <button
                      key={href}
                      onClick={() => navigate(href)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-medium ${
                        active
                          ? "text-white"
                          : isSuperAdmin
                          ? "text-amber-400/70 hover:bg-white/10 hover:text-amber-300"
                          : "text-white/50 hover:bg-white/8 hover:text-white/90"
                      }`}
                      style={active ? { background: "var(--gradient-brand)" } : undefined}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Global top bar */}
        <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-end px-5 gap-3 flex-shrink-0">
          {/* Tour trigger */}
          {(() => {
            const tourKey = Object.keys(PAGE_TOURS).find(k => pathname.startsWith(k));
            const tour = tourKey ? PAGE_TOURS[tourKey] : null;
            if (!tour) return null;
            return (
              <button
                onClick={() => startTour(tour.steps, tour.key)}
                title="Show page guide"
                className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
              >
                <HelpCircle size={14} />
              </button>
            );
          })()}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "var(--gradient-brand)" }}
              >
                {userInitial || "?"}
              </div>
              <span className="text-xs font-medium text-gray-700 max-w-[120px] truncate">{userName || userEmail}</span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-20 py-1 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
