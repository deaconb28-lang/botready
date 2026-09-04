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

---

## Notes back to the human

Appended as the build went, per the instruction at the top of this file.

### The palette needed two values changed, and that was not my call to make

`--color-warn` and `--color-fail` did not clear WCAG AA against `--color-paper`,
which is the surface almost every word in this product sits on. Measured:

|                | before | after | needs |
|---|---|---|---|
| `--color-warn` on paper | 3.16:1 | 4.62:1 | 4.5:1 |
| `--color-fail` on paper | 4.43:1 | 4.61:1 | 4.5:1 |
| `--color-pass` on paper | 4.79:1 | unchanged | 4.5:1 |

M5 asks for accessibility 100, and CLAUDE.md says the palette is a decision
already made, so those two instructions were in conflict. I took the narrowest
reading: both colours were darkened by scaling toward black, which moves
lightness and leaves hue alone, so amber still reads as amber, red still reads
as red, and the status-class mapping is untouched. `#B4702A → #8F5921` and
`#C2321F → #BD311E`. The amber is noticeably darker in the category cards and
still plainly amber.

`apps/web/__tests__/contrast.test.ts` reads the values back out of `tokens.css`
and measures them, so this cannot silently regress. If you would rather keep the
original values, that test is where to change the standard, and the honest thing
would be to lighten `--color-paper` instead of loosening the threshold.

`docs/botready-ui-mockups.html` still carries the original hexes. It is a
reference artifact rather than a build input, so I left it alone.

### Two development-only escape hatches

Both are welded shut when `NODE_ENV` is production, and both have a test
asserting that rather than a comment claiming it.

- `SCANNER_ALLOW_PRIVATE_HOSTS` lets the scan tests reach their own loopback
  fixture, which the SSRF guard exists to refuse. Without it the only way to
  test the guard, the robots-blocked path and the JS dependency ratio is to mock
  the fetcher, and then the mock is what gets tested.
- `SCANNER_PAGE_DELAY_MS` overrides the one-second inter-request gap. A scan
  makes twenty-odd sequential requests; twenty of them in a test suite is seven
  minutes of sleeping.

### What "6 pages per scan" was read to mean

Six distinct *content pages*. Pass A's five requests are five requests for one
page, and Pass C's probes are metadata files, so neither spends the budget.
Every request in a scan is still sequential and a second apart, which is the
constraint that actually protects the site being measured. A full scan is about
twenty-five requests over roughly thirty seconds, and `/bot` lists them.

### Where the spec turned out to be wrong once real pages were in front of it

- **The JS dependency ratio inverts on any page with a large inline script.**
  A client-rendered app ships its content inside an inline JSON payload, so a
  naive readable-text read of the raw HTML comes back *longer* than the same
  page's rendered DOM, and the ratio goes to zero on exactly the sites the check
  exists to catch. Script, style, noscript, template and svg bodies are stripped
  before counting. The SPA fixture went from 0.0 to 0.97 on that one change.
- **Both sides of the ratio have to be the same client.** Comparing Chrome's raw
  HTML against BotreadyBot's rendered DOM measures two variables at once. The
  scan now makes an explicit identity fetch as BotreadyBot and uses it as the
  raw side, with Pass A's five clients serving only the parity comparison.
- **robots.txt cannot be the whole of Pass C.** Reading a site's sitemap, its
  llms.txt and four `.well-known` paths before finding out whether it answers
  our user agent at all means hammering a site that has already refused us.
  Pass C is split: robots.txt, then the identity fetch, and the rest only once
  both have let us in. A WAF-blocked site now costs two requests instead of ten.

### Cut, and why

- **Tier 2 task probes and tokens-to-answer.** Deferred by the plan. The
  `evidence` table holds them without a migration: a probe is a `check_key` with
  a token count in `observed`.
- **`/app`, the monitor dashboard.** The `monitors` and `alerts` tables, the
  weekly cron and the alert diff are all built; the dashboard screen that reads
  them is not. It is retention UI for subscribers who do not exist yet, and the
  claim flow drops into a subscription rather than into a dashboard.
- **The PDF report.** The plan's own "cut first" list. The fix pack ships as a
  zip of plain files, which is what a person pastes from anyway.

### The redesign, after M8

Asked for after the nine milestones, with Mobbin as the reference source. The
searches were for a URL-input hero, an audit report, a ranking table, a pricing
section and a live progress log. What they showed: Firecrawl puts the
*machine's output* on the hero rather than a slogan; Render, Laravel Cloud and
Mintlify render progress as a dark log with status marks; Contra Labs and
basement.studio show rankings as calm full-width rows with no card chrome;
Retool and IFTTT elevate a featured tier by inverting it. Semrush, HubSpot and
Wix are the generic audit dashboards this product is positioned against.

The palette, the three faces and the status-colour semantics are pinned in
CLAUDE.md and were kept. The redesign spent its freedom on layout, hierarchy
and one signature:

- **The wire.** The two-readers split is now two literal HTTP transcripts —
  request line, headers, status line, body — and it is the landing hero, landing
  line by line (static under reduced motion). The who-gets-in table is five
  `HTTP/1.1 403 Forbidden` status lines inside the grade band. The live log,
  the paywall preview and the footer's own `robots.txt` are the same material.
- **A ledger, not cards.** The page is paper edge to edge; the result page is a
  full-width ink band, a six-column category strip, and findings as rule-
  separated sections with a status-coloured left rule.
- **The width axis.** Archivo at wdth 125 for headlines against wdth 100 labels.
  It was the design system's stated emphasis mechanism and was barely used.
- **One inverted material.** The grade band, the live log, the paywall and the
  featured pricing tier all sit on ink, so "the measurement", "the thing that is
  happening" and "the thing you pay for" read as one substance.

`tools/audit-ui.mjs` now waits for entrance animations to finish before running
axe, because a line at 20% opacity mid-entrance is not a contrast failure and
the previous version flagged it as one. The audit is clean at 1280 and 390
across every page, focus is visible on all 32 stops, and reduced motion stops
every animation.

### The Railway service exists, and it is waiting on one variable

Project `botready`, service `scanner`, building from
`deaconb28-lang/botready` on this branch with `apps/scanner/Dockerfile`,
healthcheck `/health`, restart on failure. Public URL:

    https://scanner-production-e3cc.up.railway.app

Set on the service already: `NODE_ENV`, `PORT`, `SCANNER_CONCURRENCY`,
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, `SCANNER_URL`, and a freshly generated
`SCANNER_SHARED_SECRET`. Copy that secret's value out of the Railway variables
into the Vercel project; the two sides must match.

Still to set on Railway, in this order of urgency:

1. `DATABASE_URL`, the Supabase *session* pooler string. The worker refuses to
   boot without it, on purpose, so the first deploy will show as crashed until
   this is in. Setting it triggers the redeploy.
2. `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. In production the
   worker rejects any `/scan` delivery that is not signed by QStash.

The Stripe keys, Supabase keys, Upstash Redis, `QSTASH_TOKEN`, Resend and
`CRON_SECRET` all belong to the web app on Vercel, not to the worker. The
worker never talks to Stripe.

Railway rejected `railway.json` as a config source ("Config as Code is
deprecated, use `.railway/railway.ts`"), so the same settings were applied to
the service directly. The file stays in the repo as the readable record of
what the service is configured to do.

### The ranking route directory is `app/ranking`, not `app/index`

The first Vercel deploy failed after a clean Next build with `ENOENT
.next/server/app/index/devtools.html`. A route segment literally named
`index` collides with Next's own index.html convention: the prerendered
pages are written to `app/index/index/*.html` and Vercel's builder looks one
level up. The public URL is still `/index/[segment]` as the plan says; the
route lives in `app/ranking/[segment]` with a rewrite from `/index/:segment`
and a permanent redirect back from `/ranking/:segment`, so exactly one URL
is reachable. ISR at one hour is unchanged.

### First live scan, and the four things it found

The pipeline ran end to end on 2026-09-04: the web app accepted the
scan, QStash delivered it to Railway with a valid signature, the worker
crawled example.com and wrote 21 evidence rows, and the result page and
share card rendered a D at 44. Getting there took four fixes that no local
test could have surfaced, all pushed:

1. A route directory literally named `index` breaks the Vercel build. The
   ranking lives in `app/ranking/` with a rewrite from `/index/:segment`.
2. QStash tokens are regional. `QSTASH_URL` now travels with the token.
3. QStash forbids a colon in a deduplication id. It is `scan-<uuid>` now.
4. Node 22's autoSelectFamily asks the pinned lookup for an array of
   addresses. The old bare-string answer failed every real fetch with
   "Invalid IP address: undefined". The scan tests missed it because their
   fixture is addressed by IP literal, which skips the lookup entirely.

Two configuration facts worth keeping: Supabase's direct connection host is
IPv6 only and Railway cannot reach it, so the worker must use the session
pooler; and Supabase's newer `sb_publishable_` / `sb_secret_` keys are
accepted under their own names.

### The redesign

A complete overhaul, from a three-file design handoff (vendored into
`docs/design/`). The old ink-and-paper system is gone; the new one is
hard-edged and lavender, with a 2px ink border on everything, hard offset
shadows and no blur anywhere. Three surfaces now share one component system:
the marketing site, the public result, and a signed-in account and app.

What was added rather than restyled:

- **The Plain / Technical switch.** Two copy dictionaries, not a translation
  layer: `lib/copy.ts` for the marketing strings and `lib/finding-copy.ts` for
  the findings, which reads the same observed facts and says different things
  to a founder and to an engineer.
- **The account area**: sign-in as a split screen with Google OAuth beside the
  magic link, domains, plan and billing through the Stripe customer portal,
  and the four settings toggles.
- **The app**: a sidebar shell over one claimed property with eight views.
  Overview, all issues, page detail, competitors, editor, prompt watch,
  settings and new scan.
- **Competitors and prompt watch**, which needed schema: `competitors`,
  `prompts` and `prompt_runs` in `db/migrations/0002_redesign.sql`, plus
  `user_settings`, whose `show_in_index` the public index now honours.
- **Two more generated files**: `waf-rule.txt`, written only for the agents the
  scan actually saw refused, and `botready-fixes.md`, the coding-agent prompt
  the pricing page sells. Both are built from evidence like every other file.
- **Page detail** needed something the scanner did not record, so
  `js_dependency_ratio` now carries a 320-character excerpt of each side and
  the scanner is 1.1.0. A scan from 1.0.0 shows its counts and says why the
  text is missing.

Prompt watch is the one place a model call touches the product, and it is
fenced: it asks an answer engine a buyer's question and stores the answer as
the model's words, labelled as such, with the domains it cited. No score, no
finding and no generated file reads it, and without `ANTHROPIC_API_KEY` the
feature says it is not configured rather than inventing an answer.

### Notes back to the human

**The handoff's palette does not clear WCAG AA in six places, so six values
moved.** Each one was measured, the hue is unchanged, and
`apps/web/__tests__/contrast.test.ts` now measures 69 pairs so they cannot
drift back:

| Token | Handoff | Now | Why |
|---|---|---|---|
| `green` | `#2E9B5E` | `#1F7A47` | white on it was 3.52:1 |
| `green-text` | `#3F8F1E` | `#357A19` | 4.07:1 on white |
| `subtle` | `#8B90A0` | `#666B7A` | 3.30:1, and it carries words |
| `subtle-2` | `#8A929B` | `#646978` | same |
| `placeholder` | `#A0A7AE` | `#646978` | 2.43:1, used for table headers |
| `on-violet` | `#D7D5FD` | `#E4E2FE` | 4.30:1 on violet |

**The prototype's own grade card breaks its own rule.** It draws the 88px
`C−` in white on coral, which is 2.80:1 and fails even the large-text floor;
the README says text on coral is always ink. The app follows the written rule.

**Placeholder data is gone, not reproduced.** The handoff's screens are full of
`shiplog.dev`, four competitors, twelve prompts and an invoice history. Every
one of those is now read from the database, and each screen has an empty state
that says what to do instead. The prototype's `C−`/`B+` grades became `A` to
`F`, because that is what the scorer emits.

**Three things in the handoff were deliberately not built.** The header's
"Landing page" and "Mobile" pills were a known gap in the prototype and are
removed rather than faked. The app's price and file count are computed from
`PRICING` and the real pack. The "Cancel plan" button opens the Stripe customer
portal rather than cancelling directly, because the portal is what Stripe
expects to own that decision.

**The prices moved twice.** The handoff sells the fix pack at $17 and
monitoring at $7 against the plan's original $99 and $29; you then set them to
$15 and $5. Both numbers live once, in `PRICING` in `lib/site.ts`, and every
screen and receipt line reads them from there.

**Payment links replaced the Checkout Sessions.** You supplied two live Stripe
payment links, so both Buy buttons now redirect straight to them; the
price-id path is still there and takes over when no link resolves. A payment
link is a page Stripe hosts, which means it cannot carry our metadata, so the
scan id (or the site id, for monitoring) travels as `client_reference_id` and
the webhook reads it back. The webhook tells the two plans apart by the
session's mode, since a payment link carries no `plan` key: a one-off payment
is the fix pack, a subscription is monitoring. The links are public URLs, so
they sit in `lib/site.ts` beside the prices rather than in the environment,
overridable by `STRIPE_LINK_FIXPACK` and `STRIPE_LINK_MONITOR` for test mode,
and anything that is not an https Stripe host is refused rather than
redirected to.

The webhook still needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on
Vercel, and the endpoint has to be pointed at `https://www.botready.dev/api/webhooks/stripe`.
Without them a purchase completes at Stripe and grants nothing here.

**The scanner needs a redeploy and the database needs the migration.** Page
detail is empty until a scan runs on 1.1.0, and the account and app pages
404 or error until `pnpm db:migrate` has run against Supabase.

### The weights page and the result page disagreed, and now do not

`/what-we-check` published `agent_status_parity — 18 points` while the findings
list on a failing scan printed `−13`. Both came from the same catalog and both
were right: `points` in `checks.json` is a check's share *within its category*,
and the effect on the final 100 is that share times the category's weight,
`(18/35) × 25 = 12.9`. It survived this long because four of the six categories
happen to have points summing exactly to their weight, so fifteen of the
twenty-one checks agreed by coincidence — and the six that did not are the ones
that matter most.

Fixed by publishing the derived number everywhere, not by renumbering the
catalog: an exact rescale needs `90/7` in the JSON, and a readable rounding of
it would have moved every score, which is precisely what this change promised
not to do. Every check and category also now carries a published rationale, and
the page says plainly that the weights are estimates that have not yet been
measured against whether a site gets cited.

`SCORING-PLAN.md` is the rest of it: continuous scoring in place of the
threshold cliffs, retrievability as a ceiling rather than a slice, cohort
context, and calibration against the prompt-watch data once it accumulates.

### The bot, in four scenes

A hand-drawn mascot from a later handoff: a robot surfing a two-layer wave
while status stickers drift past. The path data is carried over verbatim, since
the coordinates and stroke weights *are* the drawing; the wrapper card, the
type face and the animation declarations are house style. `BotScene` takes a
variant, and the body — antenna, torso, chest light, head, eyes — is shared,
so a new pose is arms, legs and a prop rather than a new drawing.

The handoff's palette is a generation newer than the one this site ships: its
lime is `#D6F94A` against our `#C6F53C`, its ink `#16151C` against `#111318`.
Two limes side by side on the same page read as a mistake rather than a
decision, so the graphic uses the live tokens. `PALETTE` in `BotScene.tsx` is
the one place to change that back if the rest of the site ever moves.

Three variations carry the crawler page, each answering the section it sits
beside: the bot reading robots.txt, because that is the first request of every
scan; three dots pulsing in sequence for the one-second cadence; and the bot
stopped at a dashed boundary with a 403 on it, hand short of the line, for the
section that says we do not work around a refusal. That last one is the page's
argument drawn rather than asserted.

Two things the prototype warns about and both were real. Every rotating or
scaling node needs `transform-box: fill-box`, or an SVG child's
`transform-origin: center` resolves against the viewport and the bot swings off
screen instead of bobbing. And the blanket reduced-motion rule is not enough
here: left to `animation-duration: .001ms` the scene settles on each keyframe
set's *end* state, which for the antenna ping and the spray is `opacity: 0` —
they would simply vanish. Those classes are reset to `animation: none`
explicitly, and the frozen scene was checked rather than assumed.

Two layout bugs came out of putting the graphic in a grid, both found by
measuring rather than looking. A grid item defaults to `min-width: auto`, so
the scan card's non-wrapping input row pushed the hero track past a phone's
viewport; and the crawler page's `BotreadyBot/1.0` title, which cannot wrap,
overflowed its own column beside the graphic, invisible at 1280 because the
container is centred with room to spare. The agent race had a third, older
version of the same thing: an implicit grid column is sized to max-content, so
its rows spilled out of the panel that clips them. All three are measured at
six widths now and all are zero.
