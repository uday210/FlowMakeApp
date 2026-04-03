CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  user_id      uuid,
  action       text NOT NULL,        -- e.g. "workflow.created", "execution.triggered"
  resource_type text NOT NULL,       -- "workflow" | "execution" | "connection"
  resource_id  text,
  meta         jsonb DEFAULT '{}',   -- name, status, etc.
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs(org_id, created_at DESC);
