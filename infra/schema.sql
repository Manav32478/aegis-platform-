-- Aegis Supabase schema — run this once in the Supabase SQL Editor.
-- Safe to re-run: tables use "if not exists" and policies are dropped first.

create table if not exists health_checks (
  id bigint generated always as identity primary key,
  cloud_name text,
  healthy boolean,
  latency integer,
  checked_at timestamptz default now()
);

create table if not exists organizations (
  id uuid default gen_random_uuid() primary key,
  name text,
  created_at timestamptz default now()
);

create table if not exists api_keys (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations(id),
  key_hash text,
  created_at timestamptz default now()
);

create table if not exists risk_flags (
  id bigint generated always as identity primary key,
  cloud_name text,
  flagged_at timestamptz default now()
);

-- Let the monitor (anon key) write + the dashboard read health history.
alter table health_checks enable row level security;
drop policy if exists "anon insert checks" on health_checks;
create policy "anon insert checks" on health_checks for insert with check (true);
drop policy if exists "anon read checks" on health_checks;
create policy "anon read checks" on health_checks for select using (true);

alter table risk_flags enable row level security;
drop policy if exists "anon insert flags" on risk_flags;
create policy "anon insert flags" on risk_flags for insert with check (true);
drop policy if exists "anon read flags" on risk_flags;
create policy "anon read flags" on risk_flags for select using (true);

-- API layer (Month 5): the API looks up key hashes with the anon key, and the
-- key-generation script inserts orgs + keys. NOTE: for a real product you would
-- move key creation behind a Supabase Edge Function (service_role) — the anon
-- key is public by design. Fine for this project's scope.
alter table api_keys enable row level security;
drop policy if exists "anon select keys" on api_keys;
create policy "anon select keys" on api_keys for select using (true);
drop policy if exists "anon insert keys" on api_keys;
create policy "anon insert keys" on api_keys for insert with check (true);

alter table organizations enable row level security;
drop policy if exists "anon select orgs" on organizations;
create policy "anon select orgs" on organizations for select using (true);
drop policy if exists "anon insert orgs" on organizations;
create policy "anon insert orgs" on organizations for insert with check (true);
