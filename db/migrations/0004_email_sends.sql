-- One row per email the send-email edge function has sent.
--
-- It exists for the rate limit. The function can only mail the address on the
-- session, so nobody can use it to reach a stranger; what is left to protect is
-- the Resend quota, and a bounded log is the cheapest way to count.
--
-- It also gives us a way to answer "did that email go?" without asking the
-- provider, which is the question every support thread about email opens with.

create table if not exists email_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  template    text not null,
  -- Resend's id for the message. Null when the provider accepted it without
  -- returning one, which is not an error worth failing the send over.
  provider_id text,
  created_at  timestamptz not null default now()
);

create index if not exists email_sends_user_time_idx on email_sends (user_id, created_at desc);

alter table email_sends enable row level security;

-- A person may read their own send history. Nobody writes through this policy:
-- the function inserts with the service role, so a client cannot forge a row to
-- make it look like it has used up somebody else's allowance.
drop policy if exists email_sends_own on email_sends;
create policy email_sends_own on email_sends
  for select using (auth.uid() = user_id);
