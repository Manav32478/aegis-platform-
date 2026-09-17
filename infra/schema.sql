-- ============================================================================
-- Aegis v2 — Supabase schema (self-healing multi-cloud platform)
-- Run this in the Supabase SQL Editor (Project Settings ▸ SQL Editor ▸ New query).
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.
--
-- Tables:
--   health_checks    raw probe results (one row per check per vantage point)
--   organizations    multi-tenant orgs (Month 5)
--   api_keys         hashed API keys (Month 5)
--   risk_flags       ML predictive-failover flags (Month 4)
--   incidents        downtime / degradation events (v2)
--   alerts           delivered notifications (v2)
--   monitor_targets  which clouds the platform watches (v2)
--   failover_events  traffic re-routing decisions (v2)
--   audit_log        who did what, when (v2 — security)
--   health_reports   generated daily/weekly reports (v2)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Raw health checks (v2 adds: region = vantage point, http_status)
-- ----------------------------------------------------------------------------
create table if not exists health_checks (
  id bigint generated always as identity primary key,
  cloud_name text,
  region text,
  healthy boolean,
  latency integer,
  http_status integer,
  checked_at timestamptz default now()
);
alter table health_checks add column if not exists region text;
alter table health_checks add column if not exists http_status integer;

-- ----------------------------------------------------------------------------
-- Multi-tenant orgs + API keys (Month 5)
-- ----------------------------------------------------------------------------
create table if not exists organizations (
  id uuid default gen_random_uuid() primary key,
  name text,
  created_at timestamptz default now()
);

create table if not exists api_keys (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations(id),
  key_hash text,
  label text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);
alter table api_keys add column if not exists label text;
alter table api_keys add column if not exists last_used_at timestamptz;

-- ----------------------------------------------------------------------------
-- ML predictive flags (Month 4)
-- ----------------------------------------------------------------------------
create table if not exists risk_flags (
  id bigint generated always as identity primary key,
  cloud_name text,
  flagged_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- v2: incident timeline (downtime & degraded events with duration)
-- ----------------------------------------------------------------------------
create table if not exists incidents (
  id bigint generated always as identity primary key,
  cloud_name text,
  region text,
  kind text,            -- 'downtime' | 'degraded'
  note text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds integer
);

-- ----------------------------------------------------------------------------
-- v2: alert/notification log
-- ----------------------------------------------------------------------------
create table if not exists alerts (
  id bigint generated always as identity primary key,
  cloud_name text,
  severity text,        -- 'info' | 'warning' | 'critical'
  kind text,            -- 'down' | 'recovered' | 'degraded' | 'threshold'
  message text,
  channel text,         -- 'slack' | 'webhook' | 'email' | 'none'
  delivered boolean default false,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- v2: monitored targets (what the platform is watching)
-- ----------------------------------------------------------------------------
create table if not exists monitor_targets (
  id bigint generated always as identity primary key,
  cloud_name text unique,
  url text,
  region text,
  enabled boolean default true,
  added_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- v2: failover decisions (which cloud took over for which, and why)
-- ----------------------------------------------------------------------------
create table if not exists failover_events (
  id bigint generated always as identity primary key,
  from_cloud text,
  to_cloud text,
  reason text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- v2: audit log (security — admin actions)
-- ----------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor text,
  action text,
  detail text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- v2: generated daily / weekly reports
-- ----------------------------------------------------------------------------
create table if not exists health_reports (
  id bigint generated always as identity primary key,
  period text,          -- 'daily' | 'weekly'
  period_start date,
  period_end date,
  payload jsonb,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row-Level Security
-- DEMO MODE: the publishable (anon) key may read + write. This is intentional
-- for the college project scope (no server-side service_role needed, fits the
-- free tier). Production hardening documented in docs/free-tier-notes.md:
--   → move writes behind a Supabase Edge Function using the service_role key.
-- ============================================================================

-- health_checks
alter table health_checks enable row level security;
drop policy if exists "anon insert checks" on health_checks;
create policy "anon insert checks" on health_checks for insert with check (true);
drop policy if exists "anon read checks" on health_checks;
create policy "anon read checks" on health_checks for select using (true);
drop policy if exists "anon delete checks" on health_checks;
create policy "anon delete checks" on health_checks for delete using (true);

-- risk_flags
alter table risk_flags enable row level security;
drop policy if exists "anon insert flags" on risk_flags;
create policy "anon insert flags" on risk_flags for insert with check (true);
drop policy if exists "anon read flags" on risk_flags;
create policy "anon read flags" on risk_flags for select using (true);

-- api_keys
alter table api_keys enable row level security;
drop policy if exists "anon select keys" on api_keys;
create policy "anon select keys" on api_keys for select using (true);
drop policy if exists "anon insert keys" on api_keys;
create policy "anon insert keys" on api_keys for insert with check (true);
drop policy if exists "anon update keys" on api_keys;
create policy "anon update keys" on api_keys for update using (true);

-- organizations
alter table organizations enable row level security;
drop policy if exists "anon select orgs" on organizations;
create policy "anon select orgs" on organizations for select using (true);
drop policy if exists "anon insert orgs" on organizations;
create policy "anon insert orgs" on organizations for insert with check (true);

-- incidents
alter table incidents enable row level security;
drop policy if exists "anon insert incidents" on incidents;
create policy "anon insert incidents" on incidents for insert with check (true);
drop policy if exists "anon update incidents" on incidents;
create policy "anon update incidents" on incidents for update using (true);
drop policy if exists "anon read incidents" on incidents;
create policy "anon read incidents" on incidents for select using (true);

-- alerts
alter table alerts enable row level security;
drop policy if exists "anon insert alerts" on alerts;
create policy "anon insert alerts" on alerts for insert with check (true);
drop policy if exists "anon read alerts" on alerts;
create policy "anon read alerts" on alerts for select using (true);

-- monitor_targets
alter table monitor_targets enable row level security;
drop policy if exists "anon read targets" on monitor_targets;
create policy "anon read targets" on monitor_targets for select using (true);
drop policy if exists "anon insert targets" on monitor_targets;
create policy "anon insert targets" on monitor_targets for insert with check (true);
drop policy if exists "anon update targets" on monitor_targets;
create policy "anon update targets" on monitor_targets for update using (true);
drop policy if exists "anon delete targets" on monitor_targets;
create policy "anon delete targets" on monitor_targets for delete using (true);

-- failover_events
alter table failover_events enable row level security;
drop policy if exists "anon insert failover" on failover_events;
create policy "anon insert failover" on failover_events for insert with check (true);
drop policy if exists "anon read failover" on failover_events;
create policy "anon read failover" on failover_events for select using (true);

-- audit_log
alter table audit_log enable row level security;
drop policy if exists "anon insert audit" on audit_log;
create policy "anon insert audit" on audit_log for insert with check (true);
drop policy if exists "anon read audit" on audit_log;
create policy "anon read audit" on audit_log for select using (true);

-- health_reports
alter table health_reports enable row level security;
drop policy if exists "anon insert reports" on health_reports;
create policy "anon insert reports" on health_reports for insert with check (true);
drop policy if exists "anon read reports" on health_reports;
create policy "anon read reports" on health_reports for select using (true);

-- ----------------------------------------------------------------------------
-- Seed the two live clouds so the monitor_targets table is never empty.
-- ----------------------------------------------------------------------------
insert into monitor_targets (cloud_name, url, region, enabled)
values
  ('render',           'https://aegis-platform-pomf.onrender.com/health', 'oregon',      true),
  ('vercel',           'https://aegis-platform-lyart.vercel.app/health',  'global edge', true),
  ('google-cloud-run', 'https://aegis-app-gcp.a.run.app/health',           'us-central1', false),
  ('oracle-cloud',     'http://YOUR_ORACLE_VM_IP/health',                  'ap-mumbai-1', false)
on conflict (cloud_name) do nothing;
