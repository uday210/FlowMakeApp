-- Web Analytics: sites and events

CREATE TABLE IF NOT EXISTS web_analytics_sites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  domain     text NOT NULL,
  script_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS web_analytics_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    uuid NOT NULL REFERENCES web_analytics_sites(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'pageview',  -- pageview | click | custom
  url        text,
  path       text,
  referrer   text,
  country    text,
  device     text,   -- desktop | mobile | tablet
  browser    text,
  os         text,
  session_id text,
  visitor_id text,
  properties jsonb  DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_events_site_created ON web_analytics_events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_events_site_type    ON web_analytics_events(site_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_sites_org           ON web_analytics_sites(org_id);
