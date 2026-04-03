-- Folder and tag organization for workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS folder text;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for folder filtering
CREATE INDEX IF NOT EXISTS workflows_folder_idx ON workflows(org_id, folder);
