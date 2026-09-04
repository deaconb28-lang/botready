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
  segment       text,                            -- 'saas' | 'devtools' | 'ecommerce' | 'media' | null
  -- Which of the three decided the segment. An inference drawn from a scan's
  -- own evidence never overwrites a curated or owner-stated one.
  segment_source text check (segment_source in ('seed', 'inferred', 'owner'))
);

create index sites_segment_idx on sites (segment) where segment is not null;

-- ---------------------------------------------------------------- scans

create type scan_status  as enum ('queued','running','complete','blocked','error');
create type scan_trigger as enum ('manual','cron','monitor','index','competitor');

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

-- ---------------------------------------------------------------- settings

create table user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  weekly_rescan  boolean not null default true,
  alert_on_drop  boolean not null default true,
  monthly_digest boolean not null default false,
  show_in_index  boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- competitors

-- A competitor is another site, scanned through the same pipeline, that the
-- owner of a claimed site wants ranked beside their own.

create table competitors (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id) on delete cascade,
  competitor_site_id uuid not null references sites(id) on delete cascade,
  added_by           uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (site_id, competitor_site_id),
  check (site_id <> competitor_site_id)
);

create index competitors_site_idx on competitors (site_id);

-- ---------------------------------------------------------------- prompt watch

-- A prompt is a question an owner wants asked of an answer engine each week.
-- A run records what came back: which domains the answer cited, and an
-- excerpt of the answer. The excerpt is the model's words, stored as such;
-- nothing in a run is presented as a fact about the site.

create table prompts (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  text       text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, text)
);

create index prompts_site_idx on prompts (site_id) where is_active;

create table prompt_runs (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid not null references prompts(id) on delete cascade,
  ran_at         timestamptz not null default now(),
  model          text not null,
  answer_excerpt text not null default '',
  cited_domains  jsonb not null default '[]'::jsonb,   -- ["linear.app", "height.app"]
  error          text
);

create index prompt_runs_prompt_idx on prompt_runs (prompt_id, ran_at desc);

-- ---------------------------------------------------------------- the index

-- One row per indexed site: its most recent finished scan and that scan's
-- most recent score row, plus the two facts the index table prints beside the
-- grade. Reads the `scores` table rather than re-scoring evidence, because the
-- index is two hundred rows and the result page is one; `persistScore` in the
-- web app keeps the table current, and a nightly sweep catches anything it
-- missed.
--
-- security_invoker so the underlying tables' policies apply. They are all
-- world-readable, so this changes nothing today and keeps the view honest if
-- that ever changes.

create view index_rows with (security_invoker = true) as
select
  si.id                         as site_id,
  si.domain,
  si.segment,
  si.is_claimed,
  s.id                          as scan_id,
  s.status,
  s.finished_at,
  s.scanner_version,
  sc.total,
  sc.grade,
  sc.scoring_version,
  sc.category_scores,
  parity.observed -> 'per_agent' as per_agent,
  (ratio.observed ->> 'ratio')::numeric as js_ratio
from sites si
join lateral (
  select * from scans
   where scans.site_id = si.id and scans.status in ('complete', 'blocked')
   order by scans.created_at desc
   limit 1
) s on true
left join lateral (
  select * from scores
   where scores.scan_id = s.id
   order by scores.created_at desc
   limit 1
) sc on true
left join evidence parity on parity.scan_id = s.id and parity.check_key = 'agent_status_parity'
left join evidence ratio  on ratio.scan_id  = s.id and ratio.check_key  = 'js_dependency_ratio'
-- An owner who switches off "show my score in the public index" drops out of
-- the list. The result page stays public either way.
left join user_settings us on us.user_id = si.claimed_by
where si.segment is not null
  and coalesce(us.show_in_index, true);

-- ---------------------------------------------------------------- claims

-- A claim is proven, never asserted. The token is an HMAC over (user, domain)
-- and is recomputed on verification rather than stored, so there is nothing
-- here to leak: this table only records that a proof was seen, and how.

create type claim_method as enum ('dns_txt', 'meta_tag');

create table claims (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  method      claim_method not null,
  verified_at timestamptz not null default now(),
  unique (site_id, user_id)
);

alter table claims enable row level security;
create policy "own claims" on claims for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------- rls

alter table sites        enable row level security;
alter table scans        enable row level security;
alter table evidence     enable row level security;
alter table scores       enable row level security;
alter table entitlements enable row level security;
alter table monitors     enable row level security;
alter table alerts       enable row level security;
alter table reports      enable row level security;
alter table user_settings enable row level security;
alter table competitors  enable row level security;
alter table prompts      enable row level security;
alter table prompt_runs  enable row level security;

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
create policy "own settings"     on user_settings for all using (auth.uid() = user_id);
create policy "own competitors"  on competitors  for select using (
  exists (select 1 from sites s where s.id = competitors.site_id and s.claimed_by = auth.uid())
);
create policy "own prompts"      on prompts      for select using (
  exists (select 1 from sites s where s.id = prompts.site_id and s.claimed_by = auth.uid())
);
create policy "own prompt runs"  on prompt_runs  for select using (
  exists (
    select 1 from prompts p join sites s on s.id = p.site_id
     where p.id = prompt_runs.prompt_id and s.claimed_by = auth.uid()
  )
);

-- Writes happen through the service role from the worker only. No insert or
-- update policies are defined for the anon role on purpose.
