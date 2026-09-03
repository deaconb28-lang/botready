# BUILD-PLAN.md

Nine milestones. Work them in order. Each one has a definition of done that can be checked without opening a browser, and a commit boundary. Do not start a milestone until the previous one's checks pass.

If a milestone runs long, ship it partially and note what is missing at the bottom of this file rather than skipping ahead.

---

## M0 · Scaffold (30 min)

Set up the pnpm workspace, the three packages, and the deploy targets.

**Done when**
- `pnpm typecheck` passes across all three packages
- `apps/web` renders a page on Vercel
- `apps/scanner` responds `200` to `GET /health` on Railway
- The worker rejects a request without `x-botready-secret` with a `401`

**Watch for:** `packages/core` must have zero runtime dependencies. If you find yourself installing something into it, the logic probably belongs in the worker.

---

## M1 · Guardrails (45 min)

Build this before the scanner, not after. It is easier to write a safe fetcher than to retrofit one.

Implement in `apps/scanner/src/guard.ts`:
- URL parser that rejects non-http(s) schemes, private IP ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, IPv6 unique-local), `localhost`, and any host that resolves to those after DNS lookup. Resolve first, then connect to the resolved IP, so a DNS rebind between check and fetch cannot slip through.
- A `robots.txt` parser that we obey for our own user agent.
- Per-scan page cap of 6, sequential, 1000 ms apart.
- A single shared user agent constant: `BotreadyBot/1.0 (+https://botready.dev/bot)`.

**Done when**
- Unit tests cover: `http://localhost`, `http://169.254.169.254/latest/meta-data/` (the cloud metadata endpoint, the one that actually matters), a hostname that resolves to `127.0.0.1`, and a valid public URL
- A `robots.txt` that disallows `BotreadyBot` causes the scan to return `status: 'blocked'` and stop

---

## M2 · Passes A and C, the cheap fetches (2 h)

The multi-client fetch and the well-known probes. No browser yet.

**Pass A** fetches the target URL once per client and records status, headers, byte count, redirect chain, and timing for each:

```
Chrome/141 (control)   ClaudeBot/1.0   GPTBot/1.2   PerplexityBot   Google-Extended
```

**Pass C** probes `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/.well-known/` agent manifests.

Emit `CheckResult[]` per the contract. Every check in the `discovery` and part of the `retrievability` category should now produce a real result.

**Done when**
- A scan of a known-good site (`stripe.com`) and a known-blocked site produce different `CheckResult` sets
- Every emitted `key` exists in `checks.json`, enforced by a test that iterates the catalog
- Nothing in the scanner file references a point value or a grade

---

## M3 · Pass B, render and diff (1.5 h)

Headless render with Playwright, then extract readable text from both the raw HTML of Pass A and the rendered DOM, and compute the JS dependency ratio:

```
ratio = 1 - (rawReadableChars / renderedReadableChars)
```

Use Mozilla Readability for extraction so both sides use the same algorithm. Record both character counts in `observed`. This ratio is the highest-weighted single check in the catalog, so it needs to be right.

**Done when**
- A server-rendered marketing site scores near `0.0` to `0.3`
- A client-rendered SPA scores above `0.8`
- The browser closes on every path including thrown errors, verified by a test that runs 20 scans without leaking a process

---

## M4 · Scoring (1 h)

Pure function in `packages/core/scoring.ts`. Reads weights from `checks.json`, folds `CheckResult[]` into category subscores, then a weighted total and a letter grade.

Rules: an `error` status scores as a `fail` but is flagged separately in the response so the UI can say the check could not run. A `skip` is removed from the category's denominator rather than counted as zero.

**Done when**
- Five hand-labelled fixture scans in `packages/core/__fixtures__/` produce the expected grade, and the test asserts the exact total, not a range
- `score()` has no imports outside `packages/core`
- Re-running `score()` on a stored `evidence` row from the database reproduces the stored total exactly

---

## M5 · Result page (2 h)

The public `/scan/[id]`. Build from `botready-ui-mockups.html`, which is the reference, not an inspiration board. Match the layout, the grade block, the who-gets-in table, the six category cards, the findings list with raw evidence, and the paywall preview.

Also build `/api/og/[id]` with `next/og` for the share card, and `/scan/live` with polling on `/api/scan/:id`.

**Done when**
- The page renders correctly for a scan with an `error` status on some checks
- The OG card renders at 1200x630 and shows grade, domain, and one headline fact
- Lighthouse accessibility is 100, keyboard focus is visible everywhere, and `prefers-reduced-motion` is respected
- Mobile at 390 px matches the mobile frames in the mockup

---

## M6 · Fix pack and Stripe (1 h)

Generators in `packages/core/remedies/`. All deterministic templates. The only model call in the entire product is the prose framing and the prioritisation rationale, and it never touches a fact.

Generate: `llms.txt` built from the site's real sitemap with titles, the corrected `robots.txt` block naming the agents currently refused, `<link rel="alternate">` tags for the top 20 URLs, a JSON-LD block populated from observed data, and a prioritised punch list.

Stripe Checkout for the one-time fix pack, webhook grants an entitlement, entitlement unlocks the download.

**Done when**
- The generated `llms.txt` contains only URLs that returned `200` during the scan
- The webhook is idempotent: replaying the same event twice grants one entitlement
- The paywall preview shows real generated content cut off mid-file, with no blurring

---

## M7 · Guard rails in production (1 h)

Per-IP rate limit through Upstash: 5 scans an hour anonymous, 50 signed in. 24-hour result cache keyed on normalised domain, so a link from the index cannot be turned into a hammer. Build the `/bot` page that explains who the scanner is and how to block it.

**Done when**
- The 6th anonymous scan in an hour returns `429` with a plain explanation
- Two scans of the same domain within 24 hours produce one crawl and two page views
- `/bot` exists, is linked from the user agent string, and states how to block us

---

## M8 · The index (1 h)

Seed 200 domains, nightly cron re-scan, static segment pages at `/index/[segment]`, and a `claim` flow verified by DNS TXT or a meta tag. The claim flow drops into the monitor subscription.

**Done when**
- The nightly job completes 200 scans inside its window with the concurrency cap respected
- Blocked sites appear in the table labelled blocked, with no attempt to work around it
- Claiming a domain requires proving control and cannot be done by anyone who merely knows the domain name

---

## Deferred to v2, do not start

- Tier 2 task probes and tokens-to-answer. Design the `evidence` table so it can hold them, then stop.
- Team accounts.
- Any spend-cap or proxy feature.
- A public API.

---

## Notes back to the human

Append here as you go: anything you cut, anything that took materially longer than the estimate, and any place where the spec turned out to be wrong once real sites were in front of it.
