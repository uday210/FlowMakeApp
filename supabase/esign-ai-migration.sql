-- E-Sign AI Assistant migration
-- Run this in your Supabase SQL editor

-- 1. Org-level AI config stored in org_settings table
--    (create if not already present from platform-settings-migration)
CREATE TABLE IF NOT EXISTS org_settings (
  org_id      TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS esign_ai_enabled   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS esign_ai_provider  TEXT DEFAULT 'openai',   -- 'openai' | 'anthropic'
  ADD COLUMN IF NOT EXISTS esign_ai_model     TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS esign_ai_api_key   TEXT;                    -- stored encrypted via Supabase vault or plain (see note)

-- 2. Per-document AI toggle + extracted text for context
ALTER TABLE esign_documents
  ADD COLUMN IF NOT EXISTS ai_enabled      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS extracted_text  TEXT;

-- Note: for production, store the API key using Supabase Vault:
--   SELECT vault.create_secret('sk-...', 'esign_ai_key_<org_id>');
-- For simplicity this migration stores it as plain text in org_settings.
-- You can encrypt/decrypt at the application layer as needed.

-- Add AI disclaimer field (run this if you already ran the previous migration)
ALTER TABLE esign_documents
  ADD COLUMN IF NOT EXISTS ai_disclaimer TEXT;
