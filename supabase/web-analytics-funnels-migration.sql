CREATE TABLE IF NOT EXISTS web_analytics_funnels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    uuid NOT NULL REFERENCES web_analytics_sites(id) ON DELETE CASCADE,
  name       text NOT NULL,
  steps      jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_funnels_site ON web_analytics_funnels(site_id);
