-- 0002: the account area and the app.
--
-- Applies on top of a database that already carries schema.sql as of the
-- first deploy. schema.sql is updated to match, so a fresh database gets the
-- same shape from `pnpm db:push` alone. Apply this file with `pnpm db:migrate`.

-- ---------------------------------------------------------------- settings

create table if not exists user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  weekly_rescan  boolean not null default true,
  alert_on_drop  boolean not null default true,
  monthly_digest boolean not null default false,
  show_in_index  boolean not null default true,
  updated_at     timestamptz not null default now()
);

alter table user_settings enable row level security;
drop policy if exists "own settings" on user_settings;
create policy "own settings" on user_settings for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------- competitors

-- A competitor is another site, scanned through the same pipeline, that the
-- owner of a claimed site wants ranked beside their own.

create table if not exists competitors (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id) on delete cascade,
  competitor_site_id uuid not null references sites(id) on delete cascade,
  added_by           uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (site_id, competitor_site_id),
  check (site_id <> competitor_site_id)
);

create index if not exists competitors_site_idx on competitors (site_id);

alter table competitors enable row level security;
drop policy if exists "own competitors" on competitors;
create policy "own competitors" on competitors for select using (
  exists (select 1 from sites s where s.id = competitors.site_id and s.claimed_by = auth.uid())
);

-- ---------------------------------------------------------------- prompt watch

-- A prompt is a question an owner wants asked of an answer engine each week.
-- A run records what came back: which domains the answer cited, and an
-- excerpt of the answer. The excerpt is the model's words, stored as such;
-- nothing in a run is presented as a fact about the site.

create table if not exists prompts (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  text       text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, text)
);

create index if not exists prompts_site_idx on prompts (site_id) where is_active;

create table if not exists prompt_runs (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid not null references prompts(id) on delete cascade,
  ran_at         timestamptz not null default now(),
  model          text not null,
  answer_excerpt text not null default '',
  cited_domains  jsonb not null default '[]'::jsonb,   -- ["linear.app", "height.app"]
  error          text
);

create index if not exists prompt_runs_prompt_idx on prompt_runs (prompt_id, ran_at desc);

alter table prompts enable row level security;
alter table prompt_runs enable row level security;
drop policy if exists "own prompts" on prompts;
create policy "own prompts" on prompts for select using (
  exists (select 1 from sites s where s.id = prompts.site_id and s.claimed_by = auth.uid())
);
drop policy if exists "own prompt runs" on prompt_runs;
create policy "own prompt runs" on prompt_runs for select using (
  exists (
    select 1 from prompts p join sites s on s.id = p.site_id
     where p.id = prompt_runs.prompt_id and s.claimed_by = auth.uid()
  )
);

-- ---------------------------------------------------------------- scans

-- Competitor scans are triggered from the app and spread like index scans.
alter type scan_trigger add value if not exists 'competitor';

-- ---------------------------------------------------------------- the index

-- Rebuilt so an owner who switches off "show my score in the public index"
-- drops out of the ranking list. The result page stays public either way.

drop view if exists index_rows;
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
left join user_settings us on us.user_id = si.claimed_by
where si.segment is not null
  and coalesce(us.show_in_index, true);
