-- The public statistics page.
--
-- Every number here is an aggregate over scans somebody already asked for, so
-- the page costs nothing to keep current and the claims on it are measurements
-- rather than estimates. That is the whole argument for publishing it: the
-- category is full of round numbers nobody sourced, and this is a page of
-- figures with a method and a sample size attached.
--
-- Views rather than queries because PostgREST has no group by. One view per
-- question, each carrying its own denominator, because a rate without the
-- count it was taken over is not checkable.

-- ---------------------------------------------------------------- per client

-- One row per (scan, client) with the status that client got.
--
-- The parity check's `observed.per_agent` is the only place the five statuses
-- live, so this unnests it. `?` guards a row written before the shape settled;
-- a scan with no per_agent block simply does not appear.
create or replace view agent_status_rows as
select
  e.scan_id,
  s.site_id,
  k.agent_id,
  nullif(k.value->>'status', '')::int as status,
  k.value->>'cf_mitigated'            as cf_mitigated
from evidence e
join scans s on s.id = e.scan_id
cross join lateral jsonb_each(e.observed->'per_agent') as k(agent_id, value)
where e.check_key = 'agent_status_parity'
  and e.observed ? 'per_agent';

-- Refusal rate per client, over the scans where that client was asked.
--
-- "Refused" is a 4xx or 5xx. A transport error is not a refusal — nothing was
-- measured — so status null is counted in `asked` and in neither of the other
-- two columns, and the page says so.
create or replace view client_refusal_rates as
select
  agent_id,
  count(*)::int                                                        as asked,
  count(*) filter (where status >= 400)::int                           as refused,
  count(*) filter (where status between 200 and 399)::int              as served,
  round(
    100.0 * count(*) filter (where status >= 400)
    / nullif(count(*) filter (where status is not null), 0)
  )::int                                                               as refused_pct
from agent_status_rows
group by agent_id;

-- ---------------------------------------------------------------- the asymmetry

-- Sites that let Google's agent crawler in while refusing the others.
--
-- Seven of the ten divergent sites in the first sweep did this — patagonia,
-- nytimes, airbnb, cdc.gov, budgetbytes, theguardian, theverge — and only
-- apnews and amazon refused Google alongside the rest. It has an obvious
-- explanation, nobody wants to risk their search traffic, and it is the kind
-- of specific checkable claim that makes a launch worth reading. Recomputed
-- from every scan rather than quoted from that sweep.
create or replace view google_extended_asymmetry as
with per_scan as (
  select
    scan_id,
    site_id,
    max(case when agent_id = 'chrome'     then status end) as chrome,
    max(case when agent_id = 'googleext'  then status end) as googleext,
    count(*) filter (
      where agent_id in ('claudebot', 'gptbot', 'perplexity') and status >= 400
    )                                                       as ai_refused
  from agent_status_rows
  group by scan_id, site_id
)
select
  count(*)::int                                                          as scans,
  count(*) filter (where chrome between 200 and 399)::int                as browser_served,
  count(*) filter (
    where chrome between 200 and 399 and ai_refused > 0
  )::int                                                                 as divergent,
  count(*) filter (
    where chrome between 200 and 399
      and ai_refused > 0
      and googleext between 200 and 399
  )::int                                                                 as google_allowed_others_not
from per_scan;

-- ---------------------------------------------------------------- checks

-- How often each check failed, over the scans that ran it.
--
-- Errors are counted apart from failures: an errored check is one we could not
-- run, and folding it into a failure rate would blame a site for our own
-- timeout.
create or replace view check_failure_rates as
select
  check_key,
  count(*)::int                                            as ran,
  count(*) filter (where status = 'fail')::int              as failed,
  count(*) filter (where status = 'error')::int             as errored,
  count(*) filter (where status = 'skip')::int              as skipped,
  round(
    100.0 * count(*) filter (where status = 'fail')
    / nullif(count(*) filter (where status in ('pass','warn','fail')), 0)
  )::int                                                    as failed_pct
from evidence
group by check_key;

-- ---------------------------------------------------------------- cohorts

-- Refusal and score by scoring profile, which is the only cohort a median is
-- comparable across: the profile decides which checks were counted. Joined to
-- scores rather than to sites, because that is where the profile is recorded.
create or replace view profile_stats as
select
  sc.profile,
  sc.scoring_version,
  count(*)::int                                                     as scored,
  round(percentile_cont(0.5) within group (order by sc.total))::int  as median,
  round(avg(sc.total))::int                                         as mean,
  min(sc.total)::int                                                as worst,
  max(sc.total)::int                                                as best
from scores sc
where sc.profile is not null
group by sc.profile, sc.scoring_version;

-- How many scans were refused outright, which never reach a score at all and
-- so are invisible in every view above.
create or replace view scan_outcome_rates as
select
  count(*)::int                                          as scans,
  count(*) filter (where status = 'complete')::int        as complete,
  count(*) filter (where status = 'blocked')::int         as blocked,
  count(*) filter (where status = 'error')::int           as errored,
  round(100.0 * count(*) filter (where status = 'blocked') / nullif(count(*), 0))::int as blocked_pct
from scans
where status in ('complete', 'blocked', 'error');

notify pgrst, 'reload schema';
