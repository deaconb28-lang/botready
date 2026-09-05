-- 0007 — the chart.
--
-- index_rows answers "who is in this segment, and what did they score". It is
-- still what the nightly cron reads, and it stays.
--
-- A chart needs more: where a site sits against every other site, where it sat
-- last week, the best it has ever done, and how long it has been here. All of
-- that is already in `scores`, one row per scoring of one scan, so this derives
-- it rather than storing a second copy. No snapshot table and no cron to keep
-- it honest: the chart is a query, so it cannot go stale or disagree with the
-- result pages.
--
-- Two differences from index_rows, both deliberate:
--
--   * every scanned site, not only the ones filed in a segment. 31 of 33 sites
--     have no segment, so a segmented chart is two rows and a joke. Segment is
--     still selected, so filtering by one is a where clause the caller adds.
--   * the site's own title, description and icon come along, because a chart
--     row is a thing you recognise before it is a number.
--
-- show_in_index is still honoured. Somebody who turned themselves off stays off.

create or replace view chart_rows with (security_invoker = true) as
with latest as (
  select
    si.id            as site_id,
    si.domain,
    si.segment,
    si.is_claimed,
    s.id             as scan_id,
    s.status,
    s.finished_at,
    sc.total,
    sc.grade,
    sc.scoring_version
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
  left join user_settings us on us.user_id = si.claimed_by
  where coalesce(us.show_in_index, true)
),
-- Every score ever written, with the site it belongs to. The basis for all
-- three history columns below.
history as (
  select s.site_id, sc.total, sc.created_at
    from scans s
    join scores sc on sc.scan_id = s.id
),
-- Where the site stood a week ago: its most recent score that is at least
-- seven days old. Null for anything newer than that, which is how a row earns
-- its NEW badge rather than a fake movement of zero.
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
  -- Domain breaks a tie, so two sites on the same score always come back in
  -- the same order and the chart does not shuffle between page loads.
  rank() over (order by l.total desc nulls last, l.domain) as rank,
  -- Ranked over last week's totals. Rows with no prior score sort last and
  -- then have their rank nulled, so they never occupy a place in a week they
  -- were not in.
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
  'The public chart: every scanned site ranked by its latest score, with last week''s rank, its peak and its weeks on chart derived from the scores table.';
