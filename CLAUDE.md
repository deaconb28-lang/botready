# CLAUDE.md

Persistent context for this repo. Read this before touching anything.

## What we are building

**botready.dev** measures how legible a website is to AI agents. You give it a URL, it fetches that URL as several different clients, compares what each one gets back, scores the result, and sells a pack of generated fix files.

The single most important finding the product surfaces: a site that returns `200` to Chrome and `403` to ClaudeBot from the same IP in the same second. That comparison is the headline on every screen.

## Non-negotiable constraints

These are product decisions, already made. Do not redesign them, and stop and ask if a task appears to require breaking one.

1. **The scanner never evades a block.** If a site refuses `BotreadyBot/1.0`, we record it as blocked and display it as blocked. No user-agent spoofing to get past a WAF, no residential proxies, no captcha solving. The scanner's own `robots.txt` compliance is checked in CI.
2. **Evidence and scoring are separate.** Scanner code emits observations only and never a score or a grade. Scoring is a pure function in `packages/core` that takes `CheckResult[]` and returns a score. This is what lets us re-score history when weights change.
3. **The check catalog is data, not code.** Adding, retiring or reweighting a check is an edit to `packages/core/checks.json`, never a new branch in a scoring function.
4. **Every score row records `scoring_version` and every scan row records `scanner_version`.** No exceptions.
5. **Max 6 pages per scan, sequential, 1 second apart.** We are a diagnostic tool, not a load generator.
6. **No blurred scores behind the paywall.** The diagnosis is always free and fully visible. The paid artifact is the generated fix files.

## Stack

Pinned. Do not substitute without asking.

| Layer | Choice |
|---|---|
| Web | Next.js 15, App Router, TypeScript strict, Tailwind v4 |
| Hosting (web) | Vercel |
| Worker | Node 22 + Playwright, deployed on Railway as a long-lived service |
| Queue | Upstash QStash, HTTP push to the worker |
| Cache / rate limit | Upstash Redis |
| Database | Supabase Postgres, accessed with `postgres` (postgres.js) from the worker and `@supabase/supabase-js` from the web app |
| Auth | Supabase Auth, magic link only |
| Payments | Stripe Checkout, webhook grants entitlements |
| Email | Resend |
| Package manager | pnpm workspaces |

## Repo layout

```
apps/
  web/                  Next.js app, all UI and API routes
  scanner/              Railway worker, Playwright, no UI
packages/
  core/                 Shared and framework-free
    checks.json         The check catalog
    scoring.ts          Pure scoring function
    types.ts            CheckResult, Evidence, ScanScore contracts
    remedies/           Fix-file generators (llms.txt, robots.txt, JSON-LD)
db/
  schema.sql            Source of truth for the schema
```

`packages/core` must not import anything from Next.js, Playwright, or the database. It is pure TypeScript so both sides and the tests can use it.

## Core contracts

Defined in `packages/core/types.ts`. Do not change these shapes without updating every consumer in the same commit.

```ts
type CheckStatus = 'pass' | 'warn' | 'fail' | 'error' | 'skip';

interface CheckResult {
  key: string;               // must exist in checks.json
  status: CheckStatus;
  observed: Record<string, unknown>;  // raw facts only, no interpretation
  durationMs: number;
}

interface ScanScore {
  total: number;                              // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categoryScores: Record<CategoryKey, number>;
  failedChecks: string[];
  scoringVersion: string;
}

function score(results: CheckResult[], version?: string): ScanScore;  // pure, no I/O
```

`observed` holds facts: status codes, byte counts, header values, character counts. It never holds a judgement like `"blocked": true`. The judgement is the `status` field, and the weighting is scoring's job.

## Categories and weights

Live in `checks.json`. Current v1.2 weights: retrievability 25, discovery 20, representation 20, structure 15, actionability 15, freshness 5. Weights are published on the site, so changing them is a versioned event, not a tweak.

## Design tokens

In `app/tokens.css`, imported by Tailwind v4 via `@theme`. Colour maps to HTTP status classes and that mapping is load-bearing: green is 2xx, amber is 3xx, red is 4xx, plum is 5xx. Do not introduce a colour that does not mean something.

Type: Archivo (variable width) for display only, Instrument Sans for prose, JetBrains Mono for all data. URLs, status codes, user agents and header blocks are always mono.

No percentage donuts anywhere. The score renders as an HTTP response header block with an oversized grade letter and a 20-segment meter. Reference mockups are in `botready-ui-mockups.html`.

## Voice

Active, sentence case, plain. A button says exactly what happens and the resulting toast uses the same verb. Errors state what went wrong and what to do, and never apologise. The scanner states its own limits in the interface rather than in a footer.

## Commands

```
pnpm dev                 web on :3000
pnpm --filter scanner dev    worker on :8080
pnpm test                vitest, packages/core has the meaningful coverage
pnpm typecheck
pnpm db:push             applies db/schema.sql to the linked Supabase project
```

## Environment

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
SCANNER_URL                  https URL of the Railway worker
SCANNER_SHARED_SECRET        worker rejects any request without this header
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_FIXPACK, STRIPE_PRICE_MONITOR
RESEND_API_KEY
ANTHROPIC_API_KEY            report prose only, never anything factual
```

## Things that will bite

- Playwright on Railway needs the Chromium system deps. Use `mcr.microsoft.com/playwright:v1.5x-jammy` as the base image rather than fighting apt.
- QStash signs its callbacks. Verify the signature on the worker or anyone can queue scans on your infrastructure.
- Stripe webhooks need the raw body. In App Router that means reading `await req.text()` before any JSON parsing.
- `.dev` is HSTS preloaded, so everything is HTTPS from the first request. Local dev over `http://localhost` is fine, but any staging host on the apex must have a certificate.
- Supabase connection pooling: the worker holds a long-lived connection, so use the session pooler port, not the transaction pooler.
