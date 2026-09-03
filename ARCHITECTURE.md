# botready.dev: System Architecture

**One line:** Scan a URL, measure how legible and usable that site is to AI agents, sell the fix.

**Status:** v1 spec, scoped for a 10 hour first build with a clear v2 path.

---

## 1. The core design decision

Most competitors in adjacent spaces (SEO auditors) ship a checklist. A checklist is guessable, copyable, and arguable. The thing that makes this defensible is a second measurement layer that nobody can copy without running the infrastructure:

| Tier | What it measures | Copyable? |
|---|---|---|
| Tier 1: Static audit | Does the site have llms.txt, markdown alternates, clean semantics, agent-friendly robots rules | Yes, trivially |
| Tier 2: Task probe | Can a real browsing agent actually complete 3 tasks on the site, and how many tokens does it burn doing it | No, requires running agents at scale |

Tier 2 produces the number worth marketing: **tokens-to-answer**. "An agent burns 14,200 tokens to find your pricing. Your closest competitor takes 3,100." That is a headline, a sales argument, and a benchmark all at once. It also gives you ground truth to weight Tier 1 checks against, so the score correlates with something real instead of being astrology.

Build Tier 1 this weekend. Build Tier 2 in week two, before you charge for monitoring.

---

## 2. Check catalog (Tier 1)

Six categories, weighted. Every check emits structured evidence, never a verdict. Scoring is a separate pure function so you can re-score history without re-crawling.

**Discovery (20%)**
- `robots.txt` present and parseable
- Explicit rules for known agent user agents (ClaudeBot, GPTBot, PerplexityBot, Google-Extended, CCBot, and others)
- Accidental blanket block of AI agents while allowing search crawlers
- `sitemap.xml` present, reachable, non-empty
- `/llms.txt` present, and `/llms-full.txt` if applicable
- llms.txt is valid: reachable links, no 404s in the index

**Representation (20%)**
- `<link rel="alternate" type="text/markdown">` on key pages
- `Link:` header equivalent
- Content negotiation: does the server honor `Accept: text/markdown`
- Semantic HTML: single `<h1>`, sane heading order, `<main>` landmark present
- Title and meta description present and distinct per page

**Retrievability (25%, the heaviest)**
- Plain HTTP fetch versus headless render: extract readable text from both, compute a **JS dependency ratio**. A site that returns 400 characters raw and 9,000 rendered is close to invisible to cheap agent fetches.
- Response time and payload size for the raw fetch
- HTTP status returned to each agent user agent (a 403 to ClaudeBot while returning 200 to Chrome is the single most common silent failure)
- Cloudflare or WAF challenge interception on the raw fetch
- Redirect chain depth

**Structure (15%)**
- JSON-LD present, and which types (Organization, Product, Offer, FAQPage, SoftwareApplication)
- Pricing expressed in structured data rather than only in an image or a JS-rendered table
- Canonical URL, OpenGraph completeness
- Stable heading anchor IDs

**Actionability (15%)**
- Any `.well-known` agent manifest or WebMCP endpoint
- Public API docs discoverable from the homepage in two hops
- Form semantics on primary conversion forms: `label` association, `name`, `autocomplete` tokens
- Captcha or auth wall on documentation or pricing paths

**Freshness (5%)**
- `Last-Modified` and `ETag` headers
- Changelog or updates page discoverable
- Sitemap `lastmod` values that are actually maintained

Score 0 to 100 with per-category subscores and a letter grade. Publish the weights. Arguing about the weights in public is free marketing.

---

## 3. System diagram

```
Browser
  |
  |  POST /api/scan { url }
  v
Next.js (Vercel)  ──► Upstash Redis  (rate limit + 24h dedupe cache)
  |
  |  enqueue job
  v
QStash / Inngest
  |
  v
Scanner worker (Railway, long-lived Node + Playwright)
  |
  ├─ Pass A: raw fetch x4 user agents  ──► status, headers, raw HTML
  ├─ Pass B: headless render           ──► rendered DOM, console, timing
  ├─ Pass C: well-known probes         ──► robots, sitemap, llms.txt, .well-known
  |
  └─ writes evidence JSON ──► Supabase Postgres
                                 |
                                 v
                        scoring function (pure, versioned)
                                 |
                                 v
                        /scan/[id] public result page
                                 |
                        Stripe ──► fix report generation ──► Resend
```

**Why a Railway worker rather than Vercel functions:** Playwright plus a Chromium binary is a bad fit for serverless cold starts and size limits, and scans run 10 to 40 seconds. A single always-on Railway service with a small concurrency pool is simpler, cheaper to reason about, and you already have Railway wired up. Alternative if you want zero infra: Cloudflare Browser Rendering or Browserless, at the cost of per-scan fees.

---

## 4. Data model

```sql
sites          (id, domain, first_seen_at, is_claimed, claimed_by)
scans          (id, site_id, url, status, started_at, finished_at,
                scanner_version, trigger)   -- trigger: manual | cron | leaderboard
evidence       (id, scan_id, check_key, raw jsonb, duration_ms)
scores         (id, scan_id, scoring_version, total, category_scores jsonb,
                failed_checks jsonb)
users          (id, email, created_at)
entitlements   (id, user_id, plan, stripe_customer_id, current_period_end)
monitors       (id, user_id, site_id, cadence, last_run_at, next_run_at)
alerts         (id, monitor_id, scan_id, delta jsonb, sent_at)
reports        (id, scan_id, user_id, format, generated_at, storage_key)
```

Two rules that matter later:
1. `evidence` is append-only and never contains a score. `scores` references a `scoring_version`. When you change weights in v2, you re-score every historical scan in one migration instead of losing your dataset.
2. `scanner_version` on the scan row. When a check breaks silently, you need to know which scans to distrust.

---

## 5. API surface

```
POST   /api/scan              { url }            -> { scan_id }        (rate limited)
GET    /api/scan/:id                             -> status + score + evidence summary
POST   /api/report/:scan_id                      -> Stripe checkout session
POST   /api/webhooks/stripe                      -> entitlement grant, report generation
POST   /api/monitor           { site_id, cadence }
GET    /api/leaderboard?segment=saas
POST   /api/claim             { domain }         -> DNS TXT or meta tag verification
```

Cron jobs:
- Nightly: re-scan the leaderboard cohort
- Weekly: run every active monitor, diff against previous score, fire alerts on any category drop or a new 403

---

## 6. The paid artifact

The diagnosis is the free part. The paid report has to be paste-ready, because that is the only thing worth $99 to someone who already knows their site is bad.

For each failed check, generate a concrete remedy:
- A complete `llms.txt` file, built from their actual sitemap, with page titles and one-line descriptions
- The exact `<link rel="alternate">` tags for their top 20 URLs
- A corrected `robots.txt` block with the agent user agents they are accidentally blocking
- A JSON-LD block populated with their real pricing and org data
- A prioritized punch list with estimated effort per item

Generation is deterministic templates for the artifacts, plus one model call for the prose framing and the prioritization rationale. Cost per report is a few cents. Keep the model out of anything factual.

---

## 7. Cost and abuse control

**Per scan:** roughly 1 to 3 cents with a hosted browser, effectively compute-only on your own Railway worker. Free scans are affordable at reasonable volume, which is what makes the leaderboard viable.

**Abuse:** you are shipping a tool that fetches arbitrary URLs on demand. Handle this on day one:
- Per-IP rate limit (5 scans/hour anonymous, 50 signed in)
- 24 hour result cache per domain, so a leaderboard link cannot be turned into a hammer
- Hard cap of 6 pages per scan, sequential, with a 1 second delay
- A descriptive user agent with a contact URL: `AgentreadyBot/1.0 (+https://agentready.dev/bot)`
- Honor `robots.txt` for your own crawler even though your product is partly about robots.txt
- Block private IP ranges and localhost in the URL parser (SSRF)
- No scanning of paths behind auth

That last block is not optional. A scanner that ignores it will get you null-routed and will end the leaderboard idea before it starts.

---

## 8. Build order

| Hours | Work |
|---|---|
| 0.0 to 0.5 | Repo, Vercel, Supabase, Railway worker skeleton, env wiring |
| 0.5 to 2.5 | Scanner Pass A and Pass C: raw fetch across 4 user agents, robots, sitemap, llms.txt, well-known probes. Evidence JSON shape locked here. |
| 2.5 to 4.0 | Pass B: Playwright render, readable-text extraction on both passes, JS dependency ratio |
| 4.0 to 5.0 | Scoring function, versioned, with unit tests against 5 hand-labeled sites |
| 5.0 to 7.0 | Result page: score dial, six category cards, failed check list with evidence expanders, OG image generation for sharing |
| 7.0 to 8.0 | Stripe checkout plus report generation |
| 8.0 to 9.0 | Rate limiting, cache, SSRF guard, bot identity page |
| 9.0 to 10.0 | Leaderboard: seed 200 domains, nightly cron, static segment pages |

Cut first if you run over: the leaderboard cron (seed it manually once), and the report PDF (ship markdown).

---

## 9. Known risks

**The spec is not settled.** llms.txt is a convention with real adoption but no ratified standard, and the markdown-alternate pattern is weeks old. Design the check catalog as data, not code, so adding or retiring a check is a row change. Expect to revise weights quarterly and say so publicly, since visible maintenance is itself the moat against a static competitor.

**Sites will block you.** As the leaderboard gets attention, some domains will 403 your scanner specifically. Detect it, display it honestly as "this site blocks our scanner," and move on. Do not evade blocks. Evading is both the wrong call and a fast way to lose the credibility the whole product depends on.

**Incumbent absorption.** Any established SEO auditor can add an AI-readiness tab. Your defense is Tier 2, because a checklist tab cannot produce tokens-to-answer without running agents. Get Tier 2 shipped before this category gets crowded.

**The score has to mean something.** If a site fixes everything you flag and no agent behaves differently, the product is a horoscope. Tier 2 is what keeps you honest, and running it against your own Tier 1 predictions monthly is the single most valuable internal metric you will have.

**Semrush is already partway here.** Their Site Audit ships an "AI Search Health" panel and a "Blocked from AI Search" card that lists ChatGPT-User, OAI-SearchBot, Googlebot and Google-Extended with a pass or fail against each. That is a meaningful chunk of your Discovery and Retrievability categories, sitting inside a tool that already has the audience. What they do not have is the per-agent status comparison presented as the headline, the generated fix files, or anything resembling tokens-to-answer. Position against the gap rather than the overlap, and assume the overlap widens.

---

## 10. Design system

**Colour carries meaning, not mood.** Every accent maps to an HTTP status class, so the legend is learned once and holds on every screen.

| Token | Hex | Meaning |
|---|---|---|
| `--ink` | `#16181C` | Text, primary surfaces |
| `--paper` | `#E4E6E1` | Page background, cool ash rather than cream |
| `--card` | `#F4F5F2` | Raised panels |
| `--rule` | `#C6C9C1` | Hairlines, empty meter segments |
| `--pass` | `#1F6F5C` | 2xx, passing checks |
| `--warn` | `#B4702A` | 3xx, partial credit |
| `--fail` | `#C2321F` | 4xx, refused or failing |
| `--server` | `#5B3A7E` | 5xx, reserved |

**Type, three roles.** Archivo (variable width axis, set to 106 to 124 depending on scale) for display only. Instrument Sans for prose. JetBrains Mono for every piece of data, which in this product is most of the interface and is the right call rather than a stylistic one: URLs, status codes, user agents and header blocks all read better fixed-width and all become subtly wrong in a proportional face.

**No donut.** Semrush, Squarespace and Wix all lead their audit screens with a percentage ring. The score here renders as an HTTP response header block with an oversized grade letter, plus a 20-segment meter. It reads as machine output, which is what it is.

**Signature element: the two readers.** A split panel showing the same page as Chrome received it against the same page as ClaudeBot received it, with the second side nearly empty. It appears on the landing hero and again in condensed form on mobile. This is the product thesis rendered in one glance, and it is the screenshot that travels.

---

## 11. Screen inventory

| Route | Job | Notes |
|---|---|---|
| `/` | Get a URL typed in | Hero is the two-readers split, not a value-prop headline over a gradient |
| `/scan/live` | Hold attention for 30 seconds | Streams real requests with real status codes. The wait is the demo. |
| `/scan/[id]` | Deliver the verdict, publicly | Grade block, who-gets-in table, six category cards, findings with raw evidence, paywall |
| `/index/[segment]` | Distribution | Nightly-rescanned public ranking. "Claim this site" is the conversion moment, verified by DNS TXT or meta tag. |
| `/app` | Retention | Monitor list, score history with the drop annotated, tokens-to-answer panel |
| `/api/og/[id]` | Travel | One grade, one fact, one domain. Designed before the marketing site. |
| Mobile `/scan/[id]` | Same verdict, one column | Category cards stack, the who-gets-in table stays above the fold |

**Copy rules.** Active voice, sentence case, no apologies in error states. The scanner names itself and its limits in the interface ("We identify as BotreadyBot/1.0 and obey your robots.txt"). Blocked sites are labelled blocked, never worked around, and the index says so publicly. That line is both the ethical position and the credibility play.

**Paywall behaviour.** Never blur the score. Show the generated `llms.txt` for their real domain, cut off four lines in. The diagnosis is free and the artifact is paid, which is the only honest framing for a $99 one-time charge.
