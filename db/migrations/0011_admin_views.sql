-- 0011 — aggregates for the internal dashboard.
--
-- The dashboard counted things in JavaScript, because PostgREST has no
-- group-by: it pulled the rows and tallied them. That is fine for 250 scans
-- and wrong for 25,000, and the evidence table is the one that gets there
-- first — every scan writes a row per check, so it grows twenty-one times
-- faster than anything else. These views do the grouping in SQL so the page
-- reads tens of rows instead of tens of thousands.
--
-- Same shape as chart_rows: security_invoker so the underlying tables' own
-- policies apply, and then select revoked from anon and authenticated anyway.
-- The dashboard reads with the service client, so nothing here needs to be
-- reachable with the public key, and an aggregate nobody can query is one
-- fewer thing to reason about.
--
-- Every view that describes "the web" measures one scan per site — the newest
-- settled one. Counting all evidence instead would weight a domain by how
-- often it happens to have been scanned, which makes our own test targets
-- into a statement about the internet.

-- The scan each site is currently represented by. The other views join it.
create or replace view admin_latest_scan with (security_invoker = true) as
select distinct on (sn.site_id)
  sn.site_id,
  sn.id as scan_id,
  sn.status,
  sn.created_at
from scans sn
where sn.status in ('complete', 'blocked')
order by sn.site_id, sn.created_at desc;

-- How often each check fails, across one scan per site.
create or replace view admin_check_stats with (security_invoker = true) as
select
  e.check_key,
  count(*) filter (where e.status = 'fail')  as fails,
  count(*) filter (where e.status = 'warn')  as warns,
  count(*) filter (where e.status = 'pass')  as passes,
  count(*) filter (where e.status = 'skip')  as skips,
  count(*) filter (where e.status = 'error') as errors,
  count(*)                                   as seen,
  -- Of the sites actually measured on this check. A skip is an exemption from
  -- a sector profile and belongs in neither half of a pass rate.
  round(
    100.0 * count(*) filter (where e.status = 'fail')
    / nullif(count(*) filter (where e.status <> 'skip'), 0)
  , 1) as fail_rate,
  round(avg(e.duration_ms)) as avg_ms
from evidence e
join admin_latest_scan l on l.scan_id = e.scan_id
group by e.check_key;

-- What the corpus scores per category, from the newest score of each site's
-- newest scan. Six rows.
create or replace view admin_category_scores with (security_invoker = true) as
select
  kv.key                            as category,
  round(avg(kv.value::numeric))     as average,
  count(*)                          as sites
from admin_latest_scan l
join lateral (
  select * from scores where scores.scan_id = l.scan_id
   order by scores.created_at desc limit 1
) sc on true
cross join lateral jsonb_each_text(sc.category_scores) as kv(key, value)
group by kv.key;

-- Where scans come from and how they end.
create or replace view admin_trigger_mix with (security_invoker = true) as
select trigger::text as trigger, status::text as status, count(*) as count
from scans group by 1, 2;

-- Thirty days of scans, split by outcome so a bad day is visible as a bad day
-- rather than as a busy one.
create or replace view admin_daily_scans with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(*)                                    as total,
  count(*) filter (where status = 'complete') as complete,
  count(*) filter (where status = 'blocked')  as blocked,
  count(*) filter (where status = 'error')    as errored
from scans
where created_at >= now() - interval '30 days'
group by 1;

-- How long a scan takes. One row.
create or replace view admin_scan_timing with (security_invoker = true) as
select
  count(*)                                                                       as measured,
  round(percentile_cont(0.5) within group (order by secs))::int                  as p50,
  round(percentile_cont(0.95) within group (order by secs))::int                 as p95,
  round(max(secs))::int                                                          as slowest,
  round(avg(pages_crawled), 1)                                                   as avg_pages
from (
  select extract(epoch from (finished_at - started_at)) as secs, pages_crawled
  from scans
  where finished_at is not null and started_at is not null
) t;

-- The domains we have looked at most. Ours included, which is the point:
-- if botready.dev tops this list the corpus is mostly us.
create or replace view admin_top_domains with (security_invoker = true) as
select si.domain, count(*) as scans, max(sn.created_at) as last_scan
from scans sn join sites si on si.id = sn.site_id
group by si.domain
order by count(*) desc
limit 12;

-- Which scoring rules the stored numbers were produced under. A row still
-- under 1.2 is re-scorable, and this is how you find out there are any.
create or replace view admin_scoring_versions with (security_invoker = true) as
select scoring_version, count(*) as count from scores group by 1;

revoke all on
  admin_latest_scan, admin_check_stats, admin_category_scores, admin_trigger_mix,
  admin_daily_scans, admin_scan_timing, admin_top_domains, admin_scoring_versions
from anon, authenticated;
