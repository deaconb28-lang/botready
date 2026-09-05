-- 0006 — a fix pack is bought for a domain, not for an account.
--
-- entitlements said what somebody had bought and never what they had bought it
-- for, and /api/fixpack/:scanId only asked the first question. One $15 payment
-- therefore unlocked the generated pack for every domain that had ever been
-- scanned, which on a site with a public index of scanned domains is the whole
-- catalogue for the price of one.
--
-- The column is the fix. A fixpack row now names its domain, and the download
-- checks the scan's domain against it. Buying again for another domain is $5.
--
-- NULL is deliberate and load-bearing: it means "every domain", which is
-- exactly what the rows written before this migration were sold as. Nobody who
-- has already paid loses anything, and no backfill can invent a domain for a
-- purchase that was never scoped to one.
--
-- The domain rather than the scan id, because a fix pack is regenerated from
-- whatever the latest scan found. Buying the pack for example.com and then
-- fixing three things and re-scanning should not require buying it again.

alter table entitlements add column if not exists domain text;

comment on column entitlements.domain is
  'The domain this entitlement covers. NULL means every domain, which is what rows created before 2026-09-05 were sold as.';

-- The download asks "does this user hold anything covering this domain", once
-- per download, so it is worth an index rather than a scan of the user's rows.
create index if not exists entitlements_user_domain_idx on entitlements (user_id, plan, domain);
