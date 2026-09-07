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
| Auth | Supabase Auth, Google only |
| Payments | Stripe Checkout, webhook grants entitlements |
| Email | Resend |
| Package manager | pnpm workspaces |

## Repo layout

```
apps/
  web/                  Next.js app, all UI and API routes
    app/                routes: marketing, /scan, /r, /account, /app
    components/         ui.tsx primitives, then site/ home/ results/ account/ app/
    lib/                data access, copy dictionaries, mode, theme
  scanner/              Railway worker, Playwright, no UI
packages/
  core/                 Shared and framework-free
    checks.json         The check catalog
    scoring.ts          Pure scoring function
    types.ts            CheckResult, Evidence, ScanScore contracts
    remedies/           Fix-file generators (llms.txt, robots.txt, WAF rule,
                        JSON-LD, and the coding-agent prompt)
db/
  schema.sql            Source of truth for a fresh database
  migrations/           Deltas for a database that already exists
docs/design/            The design handoff this UI was built from
```

## Surfaces

Three, and they share one component system:

| Surface | Routes | Who it is for |
|---|---|---|
| Marketing | `/`, `/what-we-check`, `/pricing`, `/bot`, `/index/[segment]` | Anyone |
| Result | `/scan/[id]`, `/r/[domain]`, `/scan/live`, `/preview/[fixture]` | Anyone, always public |
| Account | `/sign-in`, `/account`, `/account/billing`, `/account/settings` | A signed-in person |
| App | `/app/[domain]` and its seven views | A person's claimed property |

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

In `app/tokens.css`, imported by Tailwind v4 via `@theme`. The system is
hard-edged and there are no soft shadows anywhere:

- Every card, chip, button, input and toggle carries `border: 2px solid #111318`.
- Elevation is a hard offset shadow with no blur: 3px for small cards, 4px for
  standard cards, 5 to 7px for hero panels. Three panels shift the shadow to
  violet for emphasis (the check panel, the weights chart, the code viewer).
- Radii: 9 to 12px on chips and buttons, 14 to 16px on cards, 18 to 20px on
  large panels, 99px on pills. Hover on a lifted card moves it `translate(-2px,-2px)`
  and grows the shadow by 2px.

Colour is semantic. Lime `#C6F53C` is pass and the active nav; coral `#FF6B5A`
is fail and a failing grade; amber `#FFCF5C` is warn; violet `#4B44F5` is the
brand and the feature panel; green `#1F7A47` is a healthy grade. Each category
has its own colour. Text on coral, lime, amber, teal and pink is always ink;
text on violet and green is always white, and `apps/web/__tests__/contrast.test.ts`
measures every pair that carries words. Several greys and both greens are a
shade darker than the design handoff's values because the handoff's own numbers
did not clear WCAG AA; the hue is unchanged and BUILD-PLAN.md records each one.

Type: Familjen Grotesk for every heading, grade and big number, always tight;
Public Sans for body copy, buttons and labels; JetBrains Mono for every eyebrow,
status chip, metric, file name, terminal block and metadata line. Eyebrows are
uppercase mono at 10.5 to 12px with 0.12em tracking. Loaded through `next/font`,
never an `@import` of a font CDN.

Motion is declared once in `app/globals.css` so the `prefers-reduced-motion`
block cannot miss an animation. That block is required, not optional: the
marquee, the agent race and the cursors are all continuous.

The primitives live in `apps/web/components/ui.tsx` and every surface is built
from them. Reference designs are in `docs/design/`.

## Language: plain, and only plain

One register, aimed at the person who owns the site rather than the person who
deploys it. The copy lives in `apps/web/lib/copy.ts` for the marketing pages and
`apps/web/lib/finding-copy.ts` for a finding on the result page.

There was a second, technical register and a Plain ⇄ Technical switch in the
header, chosen from `apps/web/lib/mode.tsx` and persisted to localStorage. All
three are gone. Every string had to be written twice and kept true twice, both
halves went stale independently, and the switch put a control about *reading*
next to the controls for signing in. If a technical register comes back it
should be a separate page, not a second copy of every sentence on this one.

## Voice

Active, sentence case, plain. A button says exactly what happens and the resulting toast uses the same verb. Errors state what went wrong and what to do, and never apologise. The scanner states its own limits in the interface rather than in a footer.

## Commands

```
pnpm dev                 web on :3000
pnpm --filter scanner dev    worker on :8080
pnpm test                vitest, packages/core has the meaningful coverage
pnpm typecheck
pnpm db:push             applies db/schema.sql to an empty Supabase project
pnpm db:migrate          applies db/migrations/*.sql, once each, to an existing one
pnpm audit:ui            Playwright + axe over the running app
pnpm stripe:verify       asks Stripe whether it charges what the site says
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
ANTHROPIC_API_KEY            prompt watch only. Never a fact about a site: the
                             answer is stored as the model's words, labelled as
                             such, and no score or generated file reads it.
```

## Things that will bite

- Playwright on Railway needs the Chromium system deps. Use `mcr.microsoft.com/playwright:v1.5x-jammy` as the base image rather than fighting apt.
- QStash signs its callbacks. Verify the signature on the worker or anyone can queue scans on your infrastructure.
- Stripe webhooks need the raw body. In App Router that means reading `await req.text()` before any JSON parsing.
- `.dev` is HSTS preloaded, so everything is HTTPS from the first request. Local dev over `http://localhost` is fine, but any staging host on the apex must have a certificate.
- Supabase connection pooling: the worker holds a long-lived connection, so use the session pooler port, not the transaction pooler.
