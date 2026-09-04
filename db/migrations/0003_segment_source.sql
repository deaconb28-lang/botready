-- Where a site's segment came from.
--
-- Until now `sites.segment` was written only by scripts/seed-index.mjs, so a
-- site anyone scanned from the home page stayed null: invisible to the
-- index_rows view and skipped by the nightly cron, while /index/[segment] told
-- readers it listed "every site we've scanned in this category".
--
-- persistScore now infers a segment from the scan's own evidence. This column
-- records which of the three sources decided it, so an inference can never
-- overwrite a curated or owner-stated answer, and so a bad inference can be
-- found and re-run later without touching the other two.

alter table sites add column if not exists segment_source text
  check (segment_source in ('seed', 'inferred', 'owner'));

comment on column sites.segment_source is
  'seed | inferred | owner. Null for rows that predate the column.';

-- Everything with a segment today came from the seed script.
update sites set segment_source = 'seed' where segment is not null and segment_source is null;
