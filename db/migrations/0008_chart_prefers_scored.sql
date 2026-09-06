-- 0008 — the chart stops reporting a scanned site as unread.
--
-- chart_rows bound each site to its newest settled scan and left-joined that
-- scan's score. A score is written lazily — on the first read of the result
-- page, or by the nightly sweep — so a scan nobody has opened yet has none, and
-- the row came back with total null. The chart draws a null total as "not
-- read", which is the same thing it says about a site whose WAF refused us.
--
-- The nightly cron makes that the normal state rather than an edge case. It
-- sweeps unscored scans first and enqueues the night's re-scans second, so
-- every scan it starts finishes minutes after the only thing that would have
-- scored it. They wait for the next night's sweep, and in the meantime a
-- quarter of the chart reports sites we read perfectly well as unread.
--
-- Which is a false statement, and the interesting part is that a true one was
-- already in the table: the score from the scan before. So `latest` now prefers
-- the newest scan it can actually report — scored, or blocked, because a
-- refusal is real news and must not be hidden behind an older success — and
-- falls back to the newest settled scan only when a site has neither, which is
-- a site whose first scan has not been scored yet and which should still appear.
--
-- Every column on a row still comes from one scan, finished_at included, so
-- "updated 4 hours ago" continues to describe the number beside it rather than
-- some other scan of the same site.

create or replace view chart_rows with (security_invoker = true) as
with latest as (
  select
    si.id            as site_id,
    si.domain,
    si.segment,
    si.is_claimed,
    s.scan_id,
    s.status,
    s.finished_at,
    s.total,
    s.grade,
    s.scoring_version
  from sites si
  join lateral (
    select
      sn.id      as scan_id,
      sn.status,
      sn.finished_at,
      sc.total,
      sc.grade,
      sc.scoring_version
    from scans sn
    left join lateral (
      select * from scores
       where scores.scan_id = sn.id
       order by scores.created_at desc
       limit 1
    ) sc on true
    where sn.site_id = si.id and sn.status in ('complete', 'blocked')
    -- Reportable first, newest second. A scored scan and a blocked scan are
    -- both things the chart can state; a complete scan with no score yet is
    -- not, and loses to any scan that is, however new it is.
    order by (sc.total is not null or sn.status = 'blocked') desc, sn.created_at desc
    limit 1
  ) s on true
  left join user_settings us on us.user_id = si.claimed_by
  where coalesce(us.show_in_index, true)
),
history as (
  select s.site_id, sc.total, sc.created_at
    from scans s
    join scores sc on sc.scan_id = s.id
),
prior as (
  select site_id, total
    from (
      select site_id, total,
             row_number() over (partition by site_id order by created_at desc) as rn
        from history
       where created_at < now() - interval '7 days'
    ) ranked
   where rn = 1
),
agg as (
  select
    site_id,
    max(total)                                        as peak_total,
    count(distinct date_trunc('week', created_at))    as weeks_on,
    min(created_at)                                   as first_scored_at
  from history
  group by site_id
)
select
  l.site_id,
  l.domain,
  l.segment,
  l.is_claimed,
  l.scan_id,
  l.status,
  l.finished_at,
  l.total,
  l.grade,
  l.scoring_version,
  p.total          as prev_total,
  a.peak_total,
  a.weeks_on,
  a.first_scored_at,
  ident.observed #>> '{pages,0,title}'       as site_title,
  ident.observed #>> '{pages,0,description}' as site_description,
  ident.observed #>> '{pages,0,icon}'        as site_icon,
  parity.observed -> 'per_agent'             as per_agent,
  rank() over (order by l.total desc nulls last, l.domain) as rank,
  case
    when p.total is null then null
    else rank() over (order by p.total desc nulls last, l.domain)
  end as prev_rank
from latest l
left join prior p on p.site_id = l.site_id
left join agg   a on a.site_id = l.site_id
left join evidence ident  on ident.scan_id  = l.scan_id and ident.check_key = 'title_meta_distinct'
left join evidence parity on parity.scan_id = l.scan_id and parity.check_key = 'agent_status_parity';

comment on view chart_rows is
  'The public chart: every scanned site ranked by the newest scan it can report — scored, or blocked — with last week''s rank, its peak and its weeks on chart derived from the scores table.';
