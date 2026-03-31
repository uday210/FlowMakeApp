import { SupabaseClient } from "@supabase/supabase-js";

export type PlanName = "free" | "starter" | "pro" | "enterprise" | "unlimited";
export type ResourceKey = "scenarios" | "agents" | "tables" | "connections" | "secrets" | "members";

export const PLAN_LIMITS: Record<PlanName, Record<ResourceKey, number | null>> = {
  free: {
    scenarios: 5,
    agents: 2,
    tables: 2,
    connections: 3,
    secrets: 5,
    members: 2,
  },
  starter: {
    scenarios: 20,
    agents: 5,
    tables: 10,
    connections: 10,
    secrets: 20,
    members: 5,
  },
  pro: {
    scenarios: 100,
    agents: 20,
    tables: 50,
    connections: 50,
    secrets: 100,
    members: 25,
  },
  enterprise: {
    scenarios: 500,
    agents: 100,
    tables: 200,
    connections: 200,
    secrets: 500,
    members: 100,
  },
  unlimited: {
    scenarios: null,
    agents: null,
    tables: null,
    connections: null,
    secrets: null,
    members: null,
  },
};

export const PLAN_LABELS: Record<PlanName, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
  unlimited: "Unlimited",
};

const RESOURCE_TABLES: Record<ResourceKey, string> = {
  scenarios: "workflows",
  agents: "chatbots",
  tables: "user_tables",
  connections: "connections",
  secrets: "workflow_secrets",
  members: "profiles",
};

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  scenarios: "Scenarios",
  agents: "AI Agents",
  tables: "Tables",
  connections: "Connections",
  secrets: "Secrets",
  members: "Members",
};

export async function checkPlanLimit(
  supabase: SupabaseClient,
  orgId: string,
  resource: ResourceKey
): Promise<{ allowed: boolean; limit: number | null; current: number; plan: PlanName }> {
  const { data: org } = await supabase
    .from("orgs")
    .select("plan")
    .eq("id", orgId)
    .single();

  const plan = ((org?.plan as PlanName) ?? "free");
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const limit = limits[resource] ?? null;

  // null = unlimited
  if (limit === null) {
    return { allowed: true, limit: null, current: 0, plan };
  }

  const { count } = await supabase
    .from(RESOURCE_TABLES[resource])
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const current = count ?? 0;
  return { allowed: current < limit, limit, current, plan };
}
