-- Comparing a score to comparable scores.
--
-- `scores` records the version that produced a total but not the profile, and
-- the profile is half of what a total means: it decides which checks were
-- counted. A local-service site is exempt from API docs and an agent manifest,
-- a software site is not, so the two totals are built from different
-- denominators and a median across them compares nothing.
--
-- Null on every existing row. Backfilling would mean re-running inference over
-- archived evidence, which is a re-score rather than a migration, and the view
-- below simply does not count a row whose profile it does not know.
alter table scores add column if not exists profile text;

comment on column scores.profile is
  'The scoring profile the total was computed under. Null on rows written before 0015.';

create index if not exists scores_profile_idx on scores (profile, scoring_version)
  where profile is not null;

-- The median and the count, per profile per version.
--
-- Grouped by scoring_version as well as profile, and that is not tidiness: a
-- total from catalog 1.3 and a total from 1.4 are answers to different
-- questions, and averaging them would produce a number no site was ever
-- measured against. It also means a cohort is empty for a while after a
-- version ships, which the reader sees as no comparison rather than as a
-- wrong one.
--
-- A view rather than a query because PostgREST has no group by.
create or replace view cohort_medians as
select
  sc.profile,
  sc.scoring_version,
  count(*)::int                                                  as scored,
  round(percentile_cont(0.5) within group (order by sc.total))::int as median
from scores sc
where sc.profile is not null
group by sc.profile, sc.scoring_version;

comment on view cohort_medians is
  'Median total and count per scoring profile per catalog version. Empty for a version until scans have run under it.';

notify pgrst, 'reload schema';
