-- ============================================================
-- FlowMake Auth Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Organizations table
create table if not exists public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  plan       text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. User profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references public.orgs(id) on delete set null,
  full_name   text not null default '',
  avatar_url  text,
  role        text not null default 'member', -- owner | admin | member
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. Add org_id to workflows (if not already present)
alter table public.workflows
  add column if not exists org_id uuid references public.orgs(id) on delete cascade;

-- 4. Enable RLS on orgs and profiles
alter table public.orgs    enable row level security;
alter table public.profiles enable row level security;

-- 5. RLS policies for orgs
-- Users can read their own org
create policy "Users can read their org" on public.orgs
  for select using (
    id = (select org_id from public.profiles where id = auth.uid())
  );

-- 6. RLS policies for profiles
-- Users can read their own profile
create policy "Users can read own profile" on public.profiles
  for select using (id = auth.uid());

-- Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

-- 7. Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_orgs_updated_at on public.orgs;
create trigger set_orgs_updated_at before update on public.orgs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
