-- Web Analytics v2: enhanced event tracking fields
ALTER TABLE web_analytics_events
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS region        text,
  ADD COLUMN IF NOT EXISTS language      text,
  ADD COLUMN IF NOT EXISTS timezone      text,
  ADD COLUMN IF NOT EXISTS screen_width  int,
  ADD COLUMN IF NOT EXISTS screen_height int,
  ADD COLUMN IF NOT EXISTS duration_ms   int,   -- time on page in ms
  ADD COLUMN IF NOT EXISTS is_logged_in  boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wa_events_country ON web_analytics_events(site_id, country);
CREATE INDEX IF NOT EXISTS idx_wa_events_city    ON web_analytics_events(site_id, city);
