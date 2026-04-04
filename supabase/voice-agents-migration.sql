-- ── Voice Agents ──────────────────────────────────────────────────────────────

create table if not exists voice_agents (
  id                  uuid primary key default gen_random_uuid(),
  org_id              text not null,
  name                text not null,
  description         text not null default '',
  system_prompt       text not null default 'You are a helpful voice assistant. Keep responses brief and clear since this is a phone call. Do not use markdown, bullet points, or special characters.',
  greeting            text not null default 'Hello! How can I help you today?',
  voice               text not null default 'Polly.Joanna',
  language            text not null default 'en-US',
  llm_provider        text not null default 'openai',
  llm_model           text not null default 'gpt-4o-mini',
  llm_api_key         text not null default '',
  twilio_account_sid  text not null default '',
  twilio_auth_token   text not null default '',
  twilio_phone_number text not null default '',
  max_turns           integer not null default 10,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists voice_agents_org_id_idx on voice_agents(org_id);

create or replace trigger voice_agents_updated_at
  before update on voice_agents
  for each row execute function update_updated_at_column();

-- ── Voice Calls ───────────────────────────────────────────────────────────────

create table if not exists voice_calls (
  id               uuid primary key default gen_random_uuid(),
  org_id           text not null,
  agent_id         uuid references voice_agents(id) on delete set null,
  call_sid         text unique,
  direction        text not null default 'inbound',
  from_number      text not null default '',
  to_number        text not null default '',
  status           text not null default 'in-progress',
  transcript       jsonb not null default '[]',
  duration_seconds integer,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz
);

create index if not exists voice_calls_org_id_idx   on voice_calls(org_id);
create index if not exists voice_calls_agent_id_idx on voice_calls(agent_id);
create index if not exists voice_calls_call_sid_idx on voice_calls(call_sid);
create index if not exists voice_calls_started_at_idx on voice_calls(started_at desc);
