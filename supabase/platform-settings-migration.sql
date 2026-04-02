-- Platform-level settings (single row, managed by superadmin)
CREATE TABLE IF NOT EXISTS platform_settings (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  email_provider   text,        -- resend | sendgrid | mailgun | postmark | smtp | mailtrap | null
  email_from       text,
  email_from_name  text,
  email_api_key    text,        -- encrypted at rest via Supabase
  email_mailgun_domain  text,
  email_mailgun_region  text DEFAULT 'us',
  email_smtp_host  text,
  email_smtp_port  int,
  email_smtp_user  text,
  email_smtp_pass  text,
  email_smtp_secure boolean DEFAULT true,
  email_mailtrap_inbox_id text,
  updated_at   timestamptz DEFAULT now()
);

-- Seed the single row so upsert always works
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
