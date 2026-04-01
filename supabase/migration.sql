-- FlowMake: Make.com Clone
-- Run this in Supabase SQL Editor to set up the database schema

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Workflows table
create table if not exists workflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled Workflow',
  description text not null default '',
  nodes       jsonb not null default '[]',
  edges       jsonb not null default '[]',
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Executions table
create table if not exists executions (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references workflows(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed')),
  trigger_data jsonb not null default '{}',
  logs         jsonb not null default '[]',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- Index for fetching executions by workflow
create index if not exists executions_workflow_id_idx on executions(workflow_id);

-- Auto-update updated_at on workflows
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workflows_updated_at
  before update on workflows
  for each row execute function update_updated_at();

-- MCP tool executions log
create table if not exists mcp_tool_executions (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  server_id uuid not null references mcp_toolboxes(id) on delete cascade,
  tool_id uuid references mcp_tools(id) on delete set null,
  tool_name text not null,
  input_data jsonb default '{}',
  output_text text,
  status text not null check (status in ('success', 'error')),
  error_message text,
  duration_ms integer,
  transport text default 'sse',
  created_at timestamptz default now()
);
create index if not exists mcp_tool_executions_server_id_idx on mcp_tool_executions(server_id);
create index if not exists mcp_tool_executions_org_id_idx on mcp_tool_executions(org_id);
create index if not exists mcp_tool_executions_created_at_idx on mcp_tool_executions(created_at);

-- MCP alert configurations
create table if not exists mcp_alert_configs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_toolboxes(id) on delete cascade,
  org_id text not null,
  threshold float not null default 0.5,
  window_minutes integer not null default 60,
  notify_slack_url text,
  notify_email text,
  enabled boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists mcp_alert_configs_server_id_idx on mcp_alert_configs(server_id);

-- Row Level Security (optional – disable for local dev without auth)
-- alter table workflows enable row level security;
-- alter table executions enable row level security;
-- create policy "public read" on workflows for select using (true);
-- create policy "public write" on workflows for all using (true);
-- create policy "public read" on executions for select using (true);
-- create policy "public write" on executions for all using (true);
