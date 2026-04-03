import { createClient } from "@supabase/supabase-js";
import { SubscriptionManager } from "./manager";
import type { WorkflowRow } from "./types";

// ── Env validation ─────────────────────────────────────────────────────────────
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "SALESFORCE_CLIENT_ID",
  "SALESFORCE_CLIENT_SECRET",
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const manager = new SubscriptionManager(supabase, process.env.APP_URL!);

const SF_TRIGGER_TYPES = new Set([
  "trigger_salesforce_cdc",
  "trigger_salesforce_platform_event",
]);

/**
 * Load all active workflows that have a Salesforce CDC or Platform Event trigger.
 */
async function loadSalesforceWorkflows(): Promise<WorkflowRow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select("id, org_id, nodes");

  if (error) {
    console.error("[worker] Failed to load workflows:", error.message);
    return [];
  }

  return (data ?? []).filter((wf) => {
    const nodes = (wf.nodes ?? []) as WorkflowRow["nodes"];
    return nodes.some((n) => SF_TRIGGER_TYPES.has(n.data?.type));
  }) as WorkflowRow[];
}

async function tick() {
  try {
    const workflows = await loadSalesforceWorkflows();
    console.log(`[worker] Found ${workflows.length} Salesforce streaming workflow(s)`);
    await manager.sync(workflows);
  } catch (err) {
    console.error("[worker] Tick error:", err);
  }
}

// ── Start ──────────────────────────────────────────────────────────────────────
console.log("[worker] Salesforce streaming worker starting…");
tick(); // immediate first run

// Re-sync every 60 seconds to pick up new/removed workflows
setInterval(tick, 60_000);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received — shutting down");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[worker] SIGINT received — shutting down");
  process.exit(0);
});
