-- email_sends existed for one thing: rate limiting the Supabase edge function
-- that sent mail. That function is gone — everything now goes out from the web
-- app through Resend, where the key and the fix pack generator already live —
-- so nothing writes to this table and nothing reads it.
--
-- Dropped rather than left in place. An empty table with no consumer is a
-- question for whoever finds it next, and the migration is the answer.
--
-- The purchase email needs no equivalent: it is triggered by a Stripe webhook
-- rather than by a person, so there is nobody to rate limit.

drop table if exists email_sends;
