-- botready.dev schema. Source of truth. Apply with `pnpm db:push`.
--
-- Design rules that must survive every future migration:
--   1. `evidence` is append-only and contains no scores or grades.
--   2. `scores` references a scoring_version so history can be re-scored.
--   3. `scans` records scanner_version so a broken crawler can be traced.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- sites

create table sites (
  id            uuid primary key default gen_random_uuid(),
  domain        text not null unique,          -- normalised: lowercase, no scheme, no www, no trailing slash
  first_seen_at timestamptz not null default now(),
  is_claimed    boolean not null default false,
  claimed_by    uuid references auth.users(id) on delete set null,
  claimed_at    timestamptz,
  segment       text                             -- 'saas' | 'devtools' | 'ecommerce' | 'media' | null
);

create index sites_segment_idx on sites (segment) where segment is not null;

-- ---------------------------------------------------------------- scans

create type scan_status  as enum ('queued','running','complete','blocked','error');
create type scan_trigger as enum ('manual','cron','monitor','index');

create table scans (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  url             text not null,                -- the exact URL requested
  status          scan_status not null default 'queued',
  trigger         scan_trigger not null default 'manual',
  scanner_version text,                          -- set when the worker picks it up
  pages_crawled   int not null default 0,
  error_message   text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index scans_site_created_idx on scans (site_id, created_at desc);
create index scans_status_idx on scans (status) where status in ('queued','running');

-- ---------------------------------------------------------------- evidence

-- One row per check per scan. `observed` holds raw facts only: status codes,
-- header values, byte counts, character counts. Never a judgement, never a
-- point value. If you are tempted to write {"blocked": true} here, write
-- {"status_code": 403, "server": "cloudflare"} instead.

create type check_status as enum ('pass','warn','fail','error','skip');

create table evidence (
  id          uuid primary key default gen_random_uuid(),
  scan_id     uuid not null references scans(id) on delete cascade,
  check_key   text not null,                    -- must exist in packages/core/checks.json
  status      check_status not null,
  observed    jsonb not null default '{}'::jsonb,
  duration_ms int,
  created_at  timestamptz not null default now(),
  unique (scan_id, check_key)
);

create index evidence_scan_idx on evidence (scan_id);
create index evidence_key_idx on evidence (check_key);

-- ---------------------------------------------------------------- scores

-- Derived, and deliberately so. Recomputing every row from `evidence` after a
-- weight change is a single insert-select, which is the whole point of keeping
-- these tables apart.

create table scores (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references scans(id) on delete cascade,
  scoring_version text not null,
  total           int  not null check (total between 0 and 100),
  grade           text not null check (grade in ('A','B','C','D','F')),
  category_scores jsonb not null,               -- { retrievability: 22, discovery: 55, ... }
  failed_checks   jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  unique (scan_id, scoring_version)
);

create index scores_scan_idx on scores (scan_id);

-- ---------------------------------------------------------------- billing

create type plan_tier as enum ('free','fixpack','monitor');

create table entitlements (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  plan                 plan_tier not null default 'free',
  stripe_customer_id   text,
  stripe_event_id      text unique,             -- idempotency key for the webhook
  current_period_end   timestamptz,
  created_at           timestamptz not null default now()
);

create index entitlements_user_idx on entitlements (user_id);

-- ---------------------------------------------------------------- monitoring

create table monitors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  site_id      uuid not null references sites(id) on delete cascade,
  cadence      text not null default 'weekly',  -- 'weekly' | 'daily'
  last_run_at  timestamptz,
  next_run_at  timestamptz not null default now(),
  is_active    boolean not null default true,
  unique (user_id, site_id)
);

create index monitors_due_idx on monitors (next_run_at) where is_active;

create table alerts (
  id         uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  scan_id    uuid not null references scans(id) on delete cascade,
  delta      jsonb not null,                    -- { total: -19, category: 'retrievability', newly_failed: [...] }
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- reports

create table reports (
  id           uuid primary key default gen_random_uuid(),
  scan_id      uuid not null references scans(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_key  text not null,
  generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- rls

alter table sites        enable row level security;
alter table scans        enable row level security;
alter table evidence     enable row level security;
alter table scores       enable row level security;
alter table entitlements enable row level security;
alter table monitors     enable row level security;
alter table alerts       enable row level security;
alter table reports      enable row level security;

-- Scan results are public by design. That is the distribution model.
create policy "scans are world readable"    on scans    for select using (true);
create policy "evidence is world readable"  on evidence for select using (true);
create policy "scores are world readable"   on scores   for select using (true);
create policy "sites are world readable"    on sites    for select using (true);

-- Everything tied to a person is not.
create policy "own entitlements" on entitlements for select using (auth.uid() = user_id);
create policy "own monitors"     on monitors     for all    using (auth.uid() = user_id);
create policy "own reports"      on reports      for select using (auth.uid() = user_id);
create policy "own alerts"       on alerts       for select using (
  exists (select 1 from monitors m where m.id = alerts.monitor_id and m.user_id = auth.uid())
);

-- Writes happen through the service role from the worker only. No insert or
-- update policies are defined for the anon role on purpose.
