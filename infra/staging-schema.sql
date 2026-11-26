-- STAGING ONLY. Run only in a NEW, empty, separate staging Supabase project.
-- Do not run on the existing demo or any real-data database.
-- Fails if relevant tables already exist. No anon access; backend service-role only.
begin;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name in
    ('health_checks','incidents','alerts','monitor_targets','risk_flags','failover_events','health_reports')) then
    raise exception 'Staging schema refuses a non-empty target database';
  end if;
end $$;
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


-- No permissive anonymous policies. Server-side staging key must remain secret.
alter table health_checks enable row level security;
alter table risk_flags enable row level security;
alter table incidents enable row level security;
alter table alerts enable row level security;
alter table monitor_targets enable row level security;
alter table failover_events enable row level security;
alter table health_reports enable row level security;
revoke all on table health_checks, risk_flags, incidents, alerts, monitor_targets, failover_events, health_reports from anon, authenticated;
grant select, insert, update, delete on table health_checks, risk_flags, incidents, alerts, monitor_targets, failover_events, health_reports to service_role;
grant usage, select on all sequences in schema public to service_role;
commit;
