# Platform architecture: from diagnostic to measurement platform

Status: proposal. Nothing here is built. Written September 2026 against
`ca72be6`.

This is the architecture for taking botready from a one-shot diagnostic that
sells a $15 file pack to a recurring measurement platform in the shape of
[Profound](https://www.tryprofound.com). It says what Profound actually is,
what we already have, what we would have to build, in what order, what it
costs to run, and which of our existing constraints have to grow to survive
the expansion.

---

## 1. What Profound is

Four products behind one login, sold to enterprise marketing teams at
$99 / $399 / custom (third parties put custom at $2,000–5,000/mo).

| Module | What it measures | Where the data comes from |
|---|---|---|
| **Answer Engine Insights** | Whether a brand is named when an engine answers a question in its category. Share of voice, sentiment, which sources the engine cited | Their own prompts, run against ChatGPT / Perplexity / Claude / Google AI Overviews on a schedule |
| **Agent Analytics** | Which AI crawlers hit a customer's site, how often, which pages; and which AI surfaces sent human visitors that converted | The customer's own server logs — Cloudflare, AWS, Vercel |
| **Prompt Volumes** | What people actually ask engines, by volume, trending week over week | A licensed/partnered corpus they claim is 1.3B+ conversations |
| **Agents** | Nothing. It's the write side: generates and publishes content against the gaps the other three found | Customer's stack, via integrations |

The load-bearing observation: **three of those four are measurements of things
that are not the customer's website.** Answer Engine Insights measures the
engine. Prompt Volumes measures the population. Agent Analytics is the only
one that touches the customer's own infrastructure, and it does so by reading
logs rather than by fetching anything.

That is the whole difference between them and us, and it is also our opening.

---

## 2. What we are, and why that is an advantage

botready measures the **supply side**: what a machine can retrieve and parse
when it fetches a site. Profound measures the **demand side**: what engines
say and who they send.

Neither half explains itself alone. Profound can tell a customer their share
of voice fell 8 points and cannot tell them why. We can tell a customer their
pre-hydration HTML is 4% of their rendered page and cannot tell them what it
cost.

The full chain is four links:

```
  site legibility  ──►  crawler behaviour  ──►  citation in answers  ──►  referred traffic
   (we own this)        (nobody owns this)      (Profound owns this)     (Profound owns this)
```

Profound entered at link 3 and is working backwards toward link 1 — their
Agent Analytics now reports "rendering issues and structured data gaps",
which is our product, bolted onto theirs. We would enter at link 1 and work
forwards. The company that closes all four links first can say *this specific
technical fact caused this specific commercial outcome*, and nobody can say
that today.

**So the architecture is organised around the chain, not around Profound's
menu.** Four planes, built in the order that each one makes the previous one
worth more.

---

## 3. The four planes

### Plane 1 — Site (built)

`apps/scanner` fetches a URL as five clients, emits `CheckResult[]`,
`packages/core/scoring.ts` turns those into a score. 21 checks, six
categories, sector profiles, versioned. This is done and it is good.

**Changes needed:** none structurally. It becomes a scheduled input to the
other three rather than a one-shot.

### Plane 2 — Answer (half-built, build next)

What engines say when asked a question in the customer's category.

Already in the schema: `prompts`, `prompt_runs`, `competitors`, and
`apps/web/lib/prompt-probe.ts` which asks one model, one prompt, and records
the cited domains and an excerpt.

What's missing is everything that makes it a product: more than one engine,
scheduled runs, a normalised record of who got mentioned, and a derived
visibility metric that is versioned the way scoring is.

### Plane 3 — Traffic (not built)

Which verified AI crawlers actually fetched the customer's pages, and which
AI surfaces referred human visitors who then converted.

This is the plane that requires the customer to give us something — logs or
an edge hook — and it is therefore the plane that creates lock-in. It is also
the one with the real engineering cost and the real privacy exposure.

### Plane 4 — Action (quarter-built)

`packages/core/remedies/` generates eight files. Today it is a one-shot
purchase. It becomes: a finding produces a proposed change, the customer
applies it, and the next scan **proves it landed**. That verification loop is
the thing Profound's "Agents" does not do — they generate content and nothing
checks whether it worked.

---

## 4. Data model

Additive. Nothing existing changes shape.

### Answer plane

```sql
-- Engines are data, not code. Same discipline as checks.json: adding
-- Gemini is an edit to a catalog, never a new branch in a prober.
-- packages/core/engines.json:
--   { id, label, vendor, model, supports_web_search, cost_per_run_usd }

create type run_status as enum ('ok','refused','error','rate_limited');

-- One row per (prompt, engine, cycle). Replaces the shape of prompt_runs;
-- prompt_runs is migrated into it and kept as a view for one release.
create table answer_runs (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid not null references prompts(id) on delete cascade,
  cycle_id       uuid not null,              -- groups every run in one sweep
  engine_id      text not null,              -- must exist in engines.json
  model          text not null,              -- the exact model string served
  status         run_status not null,
  answer_key     text,                       -- object storage; not in Postgres
  answer_excerpt text not null default '',   -- the model's words, labelled
  prober_version text not null,
  latency_ms     int,
  error          text,
  ran_at         timestamptz not null default now()
);

create index answer_runs_prompt_idx on answer_runs (prompt_id, ran_at desc);
create index answer_runs_cycle_idx  on answer_runs (cycle_id);

-- One row per brand named in one answer. THIS IS AN OBSERVATION, not a
-- verdict: it records that the engine emitted this name at this position,
-- nothing about whether the claim was true or the brand deserved it.
create table mentions (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references answer_runs(id) on delete cascade,
  site_id     uuid references sites(id) on delete set null,  -- null if unknown
  raw_name    text not null,               -- exactly as the engine wrote it
  position    int not null,                -- 1-based order of first appearance
  is_cited    boolean not null default false,  -- did a citation back it?
  char_offset int
);

-- One row per URL the answer cited.
create table citations (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references answer_runs(id) on delete cascade,
  url      text not null,
  domain   text not null,                  -- normalised, matches sites.domain
  position int not null
);

create index citations_domain_idx on citations (domain);

-- Derived. Pure function over runs+mentions+citations, versioned exactly
-- the way ScanScore is. Re-computable from the observations at any time.
create table visibility_scores (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  cycle_id         uuid not null,
  engine_id        text,                   -- null = across all engines
  share_of_voice   numeric(5,2) not null,  -- 0-100
  mention_rate     numeric(5,2) not null,  -- % of prompts naming this site
  avg_position     numeric(4,2),
  citation_rate    numeric(5,2) not null,  -- % of mentions backed by a citation
  prompts_measured int not null,
  visibility_version text not null,
  computed_at      timestamptz not null default now(),
  unique (site_id, cycle_id, engine_id)
);
```

### Traffic plane

```sql
-- How a crawler's identity was established. A user-agent string is a claim,
-- not an identity. See §6.
create type agent_proof as enum ('rdns','ip_range','unverified','forged');

-- Raw fetches. High volume: see §7 for why most of this lives in object
-- storage and only rollups live here.
create table agent_hits (
  id           bigserial primary key,
  site_id      uuid not null references sites(id) on delete cascade,
  seen_at      timestamptz not null,
  agent_id     text not null,              -- must exist in agents.json
  proof        agent_proof not null,
  path         text not null,
  status       int not null,
  bytes        int,
  ms           int
);

create index agent_hits_site_time_idx on agent_hits (site_id, seen_at desc);

-- Pre-aggregated. What the UI actually reads.
create table agent_rollups (
  site_id    uuid not null references sites(id) on delete cascade,
  day        date not null,
  agent_id   text not null,
  proof      agent_proof not null,
  hits       int not null,
  ok         int not null,
  refused    int not null,               -- 401/403/429 to a verified crawler
  bytes      bigint not null,
  paths      int not null,               -- distinct
  primary key (site_id, day, agent_id, proof)
);

-- Human visitors an AI surface referred. Separate table because this is
-- personal-adjacent data with a different retention rule (§8).
create table ai_referrals (
  id        bigserial primary key,
  site_id   uuid not null references sites(id) on delete cascade,
  seen_at   timestamptz not null,
  surface   text not null,               -- 'chatgpt' | 'perplexity' | ...
  landing   text not null,
  converted boolean not null default false,
  value_cents int
);
```

### Action plane

```sql
-- A fix we proposed, and whether reality agrees it landed.
create table fix_applications (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  check_key     text not null,
  proposed_at   timestamptz not null default now(),
  applied_at    timestamptz,              -- customer said they shipped it
  verified_scan uuid references scans(id),-- the scan that proved it
  outcome       text check (outcome in ('pending','verified','not_detected','regressed'))
);
```

---

## 5. Services

```
apps/
  web/            Next.js. Grows the app surface; no new responsibilities.
  scanner/        Playwright worker. Unchanged.
  prober/         NEW. Answer plane. Runs prompts against N engines on a
                  schedule. Long-lived Node service on Railway, same shape
                  as scanner: QStash pushes a cycle, it walks the matrix.
  collector/      NEW. Traffic plane. Two jobs: accept log batches at an
                  authenticated endpoint, and verify crawler identity.
                  Stateless and horizontally scalable — unlike scanner and
                  prober, this one gets bursty.
packages/
  core/
    checks.json       existing
    engines.json      NEW — the engine catalog, data not code
    agents.json       NEW — crawler identity: UA patterns, rDNS suffixes,
                      published IP-range URLs. Lifted and expanded from the
                      `agents` key already in checks.json.
    scoring.ts        existing, unchanged
    visibility.ts     NEW — pure. (runs, mentions, citations) -> VisibilityScore
    identity.ts       NEW — pure. (ua, rdns result, ip) -> {agent_id, proof}
    remedies/         existing
```

`packages/core` stays framework-free. `visibility.ts` and `identity.ts` are
pure functions with no I/O for exactly the same reason `scoring.ts` is: so
that history can be recomputed when the method changes, and so the tests can
run the real thing.

**Why `prober` is a separate service and not a cron route in `web`:** a full
cycle for 200 customers at 100 prompts across 3 engines is 60,000 model calls
with web search enabled. That is hours of wall time, per-engine rate limits,
and retry state. Vercel functions are the wrong shape. Railway, same as the
scanner, is the right one.

**Why `collector` is separate from `web`:** a Vercel log drain for one busy
customer is thousands of requests per minute of pure write traffic that must
never contend with a page render, and its scaling profile is nothing like the
app's.

---

## 6. Crawler identity: verify, never trust

This is the single most important technical decision in the traffic plane and
it is also the one most aligned with what botready already is.

A user-agent string is a claim. `ClaudeBot/1.0` in a log line means someone
sent those bytes. Profound's Agent Analytics, and every log-analytics product
in this category, reports user-agent counts as though they were crawler
counts. They are not. A meaningful fraction of "AI crawler traffic" in any
real log is scrapers wearing a costume, and reporting it as ChatGPT gives the
customer a number that is wrong in the flattering direction.

`packages/core/identity.ts` resolves every hit to one of four proofs:

- **`rdns`** — forward-confirmed reverse DNS. Reverse-lookup the IP, check
  the hostname ends in the vendor's published suffix, forward-resolve that
  hostname and confirm it returns the original IP. The gold standard, and the
  method the vendors themselves document.
- **`ip_range`** — the IP is inside a range the vendor publishes as JSON.
  Cheaper, refreshed daily into Redis, and the fallback where a vendor
  publishes ranges but no rDNS.
- **`unverified`** — claims an agent UA, no proof either way. Reported
  separately, never folded into the verified count.
- **`forged`** — claims an agent UA and the IP provably belongs to someone
  else. **This is a finding we can sell.** No one else in the category
  surfaces it, and "18% of the ChatGPT traffic in your logs last month was
  not ChatGPT" is a headline on its own.

Verification is cached per-IP in Redis with a long TTL; the DNS cost per
unique IP is paid once a week, not once a hit.

---

## 7. Volume and cost, honestly

### Traffic plane volume

One mid-size customer generates maybe 50k crawler hits a day. Two hundred of
them is 10M rows/day, 300M/month. Supabase Postgres is the wrong home for
that and the bill will say so before the query planner does.

**Raw hits go to object storage** (Supabase Storage or S3), partitioned
`site_id/date/`, newline-delimited JSON, compressed. **Postgres holds
`agent_rollups` only** — one row per site/day/agent/proof, which for 200
customers and 8 agents is ~5k rows/day and trivially cheap. The UI reads
rollups. Raw is read only when someone drills into a single day, and it is
read from storage.

If drill-down gets popular, that is the moment to put ClickHouse in front of
the raw files, not before. The rollup design means adding it later changes
one module.

### Answer plane cost

This is recurring COGS and it sets the price floor, so it belongs in the
architecture rather than in a spreadsheet.

One run = one model call with web search. Call it $0.03 all-in.

| Tier | Prompts | Engines | Cadence | Runs/mo | COGS/mo |
|---|---|---|---|---|---|
| Small | 25 | 1 | weekly | 100 | ~$3 |
| Mid | 100 | 3 | weekly | 1,200 | ~$36 |
| Large | 250 | 5 | daily | 37,500 | ~$1,125 |

Two things fall out of that table.

**The $5/month monitor cannot carry the answer plane.** It carries a re-scan,
which is nearly free. Anything that asks engines questions starts at a price
that covers $36 of COGS at 80% margin, so ~$179/mo. That is Profound's Growth
tier at $399 with room underneath it, which is the right place to be.

**Daily cadence is a tier, not a setting.** The cost is linear in cadence and
a customer who flips a toggle from weekly to daily multiplies our COGS by
seven. It is priced, or it does not exist.

---

## 8. Privacy: the thing that changes most

Today botready holds no personal data about anyone but its own account
holders. It fetches public pages and stores public facts.

The traffic plane ingests **other people's visitor logs**. That is a
different company from a data-protection standpoint, and the architecture has
to carry it:

- **Human visitor IPs are never stored.** The collector hashes or drops them
  at ingest, in memory, before anything is written. Only crawler IPs survive,
  and only long enough to verify identity — the verification result is stored,
  the IP is not.
- **`ai_referrals` holds no identifier.** Surface, landing path, conversion
  flag, value. No session id, no user id, no IP, no UA.
- **Raw log objects have a hard TTL** — 30 days, enforced by a storage
  lifecycle rule rather than by a cron job we might break. Rollups are
  permanent.
- **We become a processor,** and need a DPA, a sub-processor list, and a
  documented deletion path before the first enterprise customer, not after.
- **No customer traffic data ever reaches a model.** The existing rule about
  `ANTHROPIC_API_KEY` extends: it is for asking public questions of engines,
  never for reasoning over a customer's logs.

This is the highest-risk part of the whole plan and it is worth being slow
about. A breach here is not "our scores leaked", it is "we leaked a
customer's traffic".

---

## 9. Constraints, amended

The six in `CLAUDE.md` all survive. Two need widening and five are new. All
of these are testable and should be tests.

**Amended:**

2. *Evidence and scoring are separate* → **Observation and derivation are
   separate, on every plane.** A scan emits `CheckResult[]`; a probe emits
   runs, mentions and citations; a collector emits hits. Every number a
   customer sees — score, share of voice, crawler count — is a pure function
   over those, carrying its own version. Nothing derived is ever the only
   copy of anything.

3. *The check catalog is data* → **Every catalog is data.** `checks.json`,
   `engines.json`, `agents.json`. Adding Gemini, retiring a check, or
   learning a new crawler's IP ranges is a data edit.

**New:**

7. **Crawler identity is verified, never asserted.** Every hit carries its
   proof. A UA claim with no proof is never counted as the agent it claims.
8. **A model's answer is evidence about the model.** Already true of prompt
   watch; it now governs the whole answer plane. An engine saying a customer
   is the market leader is recorded as the engine having said it. It never
   becomes a fact, a score input, or a line in a generated file.
9. **Human visitor data is anonymous at ingest**, not anonymised later.
10. **Cadence is priced.** No setting in the UI can multiply our COGS.
11. **We do not buy or claim a conversation corpus.** See below.

---

## 10. What we deliberately do not build

**Prompt Volumes.** Profound's "1.3B+ real user conversations" is a data
partnership, and it is their actual moat — not their UI, not their agents.
We cannot match it, and the failure mode of trying is inventing volume
numbers, which for a product whose entire pitch is "we only report what we
measured" would be terminal.

The honest version we *can* build: prompt **suggestion** derived from the
customer's own pages, their competitors' pages, and public search data,
labelled as suggestions rather than measured volume. It's a weaker feature.
It is also one we can defend in a room, and the label is the product.

**Content generation agents.** Profound's Create tier writes and publishes
content. Everyone is building that and it commoditised inside a year. Our
version of the write side is narrower and better: a fix, applied, then
**verified by a re-scan**. Profound generates and hopes. We can close the
loop, and closing the loop is a claim nobody in the category can currently
make.

---

## 11. Phasing

Each phase is shippable and sellable alone.

### Phase 1 — Answer plane (≈8 weeks)

Multi-engine prober, mentions/citations, share of voice, competitor
comparison. The `/app/[domain]/watch` view becomes the main event.

*Ships:* the first product we can charge $179/mo for.
*Why first:* half the schema exists, it needs nothing from the customer, and
it is the module Profound leads with. Also the only phase whose value does
not depend on any other phase.

### Phase 2 — Traffic plane, ingest only (≈10 weeks)

Collector service, Vercel log drain first (our ICP is Vercel-shaped), then
Cloudflare Logpush, then a manual log upload for everyone else. Identity
verification. Rollups. A crawler-activity view.

*Ships:* "which AI crawlers actually visit you, and how many are lying".
*Why second:* it is the lock-in. A customer who has pointed their log drain
at us does not casually leave.

### Phase 3 — Close the loop (≈6 weeks)

Correlate the three planes on one timeline: a check regressed here, crawler
hits fell there, share of voice moved a fortnight later. Referral and
conversion tracking.

*Ships:* the sentence no competitor can say — *this technical change cost
you this much visibility.*
*Why third:* it is arithmetic over data the first two phases collect. Cheap
to build, impossible to fake, and it is the actual thesis of the company.

### Phase 4 — Verified fixes (≈6 weeks)

`fix_applications`, the apply-and-prove loop, and a monthly report that shows
what was fixed and what moved.

*Ships:* renewal evidence, which is what determines whether any of this is a
business.

---

## 12. Where the current app is already the right shape

Worth stating plainly, because it means this is an extension rather than a
rewrite:

- `/app/[domain]` already has seven views and a sidebar shell. The three new
  ones (answers, crawlers, timeline) slot in beside them.
- `monitors`, `alerts`, `reports` already exist and already run on a cadence.
  The answer plane is a third thing that has a cadence and produces deltas.
- `competitors` already exists and already resolves to `sites`, so share of
  voice against named competitors is a join, not a new concept.
- The `scan_trigger` enum already has `monitor` and `competitor` members.
- `claims` already proves domain ownership, which is the exact gate a log
  drain has to sit behind.
- Public reports at `/r/[domain]` stay free and stay the top of the funnel.
  Nothing in this plan puts the diagnosis behind a login — constraint 6
  survives intact.

---

## 13. The one-line version

Profound sells you the scoreboard. We already own the only camera pointed at
the pitch. Build the scoreboard second, and we are the only ones who can show
the replay.
