-- Add watermark support to esign_documents
ALTER TABLE esign_documents
  ADD COLUMN IF NOT EXISTS watermark_text TEXT,
  ADD COLUMN IF NOT EXISTS original_file_path TEXT;
