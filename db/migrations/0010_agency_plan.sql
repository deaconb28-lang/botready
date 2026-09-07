-- The agency tier.
--
-- Monitoring at $5 covers one person watching their own site. An agency
-- watches ten of somebody else's, and the thing it needs that monitoring does
-- not have is a pooled prompt allowance across all of them: the questions
-- worth asking about a client's category are a property of the client, not of
-- the agency, and ten separate allowances of twelve is both wrong and
-- expensive.
--
-- A new enum member rather than a column on entitlements, because `plan` is
-- already the discriminator every consumer reads and adding a second one is
-- how two sources of truth start.
--
-- ADD VALUE cannot be used in the same transaction that creates it, which is
-- why nothing else is in this file.

alter type plan_tier add value if not exists 'agency';
