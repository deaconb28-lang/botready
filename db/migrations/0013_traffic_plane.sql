-- 0013 — the traffic plane: which crawlers actually fetched a customer's pages.
--
-- The first table in this database that holds a shadow of somebody else's
-- visitors, so constraint 9 is a property of the schema rather than a promise
-- about the code: there is nowhere here to put an IP address, a session id or
-- a user agent belonging to a person. The collector resolves a crawler's IP to
-- a verdict in memory and writes the verdict; a human's IP is dropped before
-- anything is written, and the only thing kept about a human visit is which AI
-- surface referred it and where it landed.
--
-- Volume is why there are two tables. One busy customer is ~50k crawler hits a
-- day, so raw hits are kept for a fortnight to answer "what happened on
-- Tuesday" and the rollups are permanent. When raw outgrows Postgres the
-- rollups do not change shape, which is the point of writing them separately
-- now rather than deriving them later.

-- How an identity was established. Constraint 7: a claim with no proof is
-- never counted as the agent it claims to be, and `forged` is a disproof
-- rather than an absence of proof.
create type agent_proof as enum ('rdns', 'ip_range', 'unverified', 'forged');

-- The write token a customer's log drain presents. One per site, revocable,
-- and stored hashed for the same reason a password is: this row grants the
-- ability to write into their analytics.
create table ingest_keys (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  -- sha256 of the token. The plaintext is shown once, at creation, and never
  -- again — there is nothing here to leak if this table is read.
  token_hash   text not null unique,
  -- The first characters, so the interface can say which key is which without
  -- being able to reconstruct one.
  hint         text not null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index ingest_keys_site_idx on ingest_keys (site_id) where revoked_at is null;

-- One row per fetch by something claiming to be an agent. No IP column, by
-- design and not by omission.
create table agent_hits (
  id       bigserial primary key,
  site_id  uuid not null references sites(id) on delete cascade,
  seen_at  timestamptz not null,
  agent_id text not null,             -- must exist in packages/core/agents.json
  proof    agent_proof not null,
  path     text not null,
  status   int not null,
  bytes    int,
  ms       int
);

create index agent_hits_site_time_idx on agent_hits (site_id, seen_at desc);

-- What the interface reads. One row per site per day per agent per verdict,
-- which for a hundred customers and fifteen agents is a few thousand rows a
-- day rather than a few million.
create table agent_rollups (
  site_id  uuid not null references sites(id) on delete cascade,
  day      date not null,
  agent_id text not null,
  proof    agent_proof not null,
  hits     int not null default 0,
  ok       int not null default 0,
  refused  int not null default 0,    -- 401, 403, 429 to something we verified
  bytes    bigint not null default 0,
  primary key (site_id, day, agent_id, proof)
);

-- A human an AI surface sent. Deliberately thin: no identifier of any kind,
-- because the question this answers is "did ChatGPT send anyone to the pricing
-- page" and every field beyond that is somebody's personal data held for a
-- question nobody asked.
create table ai_referrals (
  site_id uuid not null references sites(id) on delete cascade,
  day     date not null,
  surface text not null,              -- must exist in agents.json referrers
  landing text not null,
  visits  int not null default 0,
  primary key (site_id, day, surface, landing)
);

-- Everything here is one customer's own traffic, so it is theirs to read and
-- nobody else's. The collector and the dashboard both use the service client;
-- these policies exist so a future read with the public key cannot leak across
-- accounts by accident.
alter table ingest_keys  enable row level security;
alter table agent_hits   enable row level security;
alter table agent_rollups enable row level security;
alter table ai_referrals enable row level security;

create policy own_ingest_keys on ingest_keys for select
  using (exists (select 1 from sites s where s.id = ingest_keys.site_id and s.claimed_by = auth.uid()));
create policy own_agent_hits on agent_hits for select
  using (exists (select 1 from sites s where s.id = agent_hits.site_id and s.claimed_by = auth.uid()));
create policy own_agent_rollups on agent_rollups for select
  using (exists (select 1 from sites s where s.id = agent_rollups.site_id and s.claimed_by = auth.uid()));
create policy own_ai_referrals on ai_referrals for select
  using (exists (select 1 from sites s where s.id = ai_referrals.site_id and s.claimed_by = auth.uid()));

comment on table agent_hits is
  'Raw crawler fetches, kept a fortnight. No IP column by design: constraint 9.';
comment on table ai_referrals is
  'Counts of human visits an AI surface referred. No identifier of any kind.';
