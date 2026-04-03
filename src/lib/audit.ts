import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditParams {
  supabase: SupabaseClient;
  orgId: string;
  userId?: string;
  action: string;         // e.g. "workflow.created"
  resourceType: string;   // "workflow" | "execution" | "connection"
  resourceId?: string;
  meta?: Record<string, unknown>;
}

export async function logAudit({
  supabase, orgId, userId, action, resourceType, resourceId, meta = {},
}: AuditParams): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      org_id: orgId,
      user_id: userId ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      meta,
    });
  } catch {
    // Never let audit logging break the main flow
  }
}
