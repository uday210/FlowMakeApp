"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHeader } from "@/components/AppShell";
import {
  Globe,
  Copy,
  CheckCheck,
  ExternalLink,
  Plus,
  Search,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface WebhookEntry {
  id: string;
  workflow_id: string;
  workflow_name: string;
  node_id: string;
  node_label: string;
  url: string;
  method: string;
}

export default function WebhooksPage() {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/webhooks-list")
      .then((r) => r.json())
      .then((d) => setWebhooks(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const copy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = webhooks.filter(
    (w) =>
      w.workflow_name.toLowerCase().includes(search.toLowerCase()) ||
      w.node_label.toLowerCase().includes(search.toLowerCase()) ||
      w.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="Webhooks"
        subtitle="All webhook trigger URLs across your scenarios"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Plus size={14} /> New scenario
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto px-8 py-6">
        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search webhooks…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Globe size={24} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              {search ? `No webhooks match "${search}"` : "No webhooks yet"}
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Add a Webhook trigger to a scenario to get a URL
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Go to scenarios
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenario</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">URL</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((wh) => (
                  <tr key={wh.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Globe size={13} className="text-violet-600" />
                        </div>
                        <span className="font-medium text-gray-800 text-xs">{wh.node_label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => router.push(`/workflows/${wh.workflow_id}`)}
                        className="text-xs text-violet-600 hover:text-violet-800 hover:underline transition-colors"
                      >
                        {wh.workflow_name}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        {wh.method}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <span className="text-xs text-gray-500 font-mono truncate block">{wh.url}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => copy(wh.url, wh.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {copied === wh.id ? (
                            <><CheckCheck size={12} className="text-green-500" /> Copied</>
                          ) : (
                            <><Copy size={12} /> Copy</>
                          )}
                        </button>
                        <button
                          onClick={() => router.push(`/workflows/${wh.workflow_id}`)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
