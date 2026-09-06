-- 0009 — say "unlimited" out loud.
--
-- 0006 added entitlements.domain and left the rows that predated it null,
-- with null meaning every domain so that nobody lost what they had been sold.
-- That was right for those rows and wrong as a rule, because null is also what
-- a grant looks like when something went wrong: a payment link with no
-- reference attached, or a scan lookup that comes back empty, both leave the
-- webhook with no domain to write. The rule could not tell a deliberate
-- unlimited grant from a failed lookup, so it read both the generous way and a
-- $15 purchase could come out holding every domain on the public index.
--
-- So the two stop sharing a value. The grants that were sold as unlimited say
-- so, and null goes back to meaning what it looks like: one pack whose domain
-- is not known yet, which the download route stamps with the first domain it
-- is spent on.
--
-- Scoped to rows that exist now. A null written after this point is a new
-- purchase awaiting its domain, not a grandfathered licence, and must not be
-- swept up by a later re-run of this file.

update entitlements
   set domain = '*'
 where domain is null
   and created_at < '2026-09-06T00:00:00Z';

comment on column entitlements.domain is
  'The domain this grant covers. ''*'' is every domain, which only the grants sold before the pack was scoped carry. Null is a grant whose domain is not known yet: it covers the first domain it is spent on and is stamped with it there.';
