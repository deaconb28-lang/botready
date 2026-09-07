# The plan to first revenue

Written against a stated goal of **$1,000 MRR within a month**. The first
section is why that number is the wrong one and what to aim at instead. The
rest is the plan for the target that is actually reachable.

`schedule.md` is the launch-week clock and still governs day 0. This is the
month around it.

## The arithmetic, first

MRR is recurring revenue, and only one of the three prices recurs.

| | | |
|---|---|---|
| Fix pack | $15 | **one time** |
| Extra domain | $5 | one time |
| Monitoring | $5 | **per month** |

So `$1,000 MRR ÷ $5 = 200 active monitoring subscribers`. Monitoring is an
upsell after the fix pack, so reaching 200 means:

| If this share of buyers adds monitoring | Fix packs needed | Scans needed at 3% |
|---|---|---|
| 20% (optimistic) | 1,000 | **33,000** |
| 15% (plausible) | 1,333 | **44,400** |
| 10% (conservative) | 2,000 | **66,700** |

Forty thousand scans in thirty days, from a standing start, with no audience and
no published study. A #1 Product Hunt day is a few thousand visitors. A thread
that genuinely takes off is a few thousand clicks. This is off by more than an
order of magnitude, and no amount of posting closes that gap.

**The conversion rates above are assumptions, not measurements.** We have no
funnel data yet — `measurement.md` names the four numbers to collect and they are
all currently zero. Every projection here should be replaced with real rates as
soon as there are any.

## The two targets that are real

**Month 1 — $1,000 in total revenue.** 67 fix packs, about 2,200 scans at 3%.
That is a good launch month and it is achievable with the channels below.
Expect it to leave roughly **$50–100 MRR** trailing behind it, from the ~10
buyers who also take monitoring.

**$1,000 MRR — a 60 to 90 day target, and it needs a pricing change.**

## The change that makes $1k MRR reachable

`LIMITS.monitor` is already `{ domains: 3, scansPerMonth: 30 }` — monitoring is
per-account, not per-domain. That shape is one step from the thing that actually
gets to $1,000.

**200 founders at $5 is hard. 21 agencies at $49 is not.**

An agency running 25 client sites has 25 reasons to care that a WAF update
turned a client red, and a per-seat price of $2 a site. That is an easy yes for
them and a 10× shorter path for us. `linkedin.md` already has an agency angle
written for follow-up 3.

| Route | Customers for $1k MRR | Realistic timeline |
|---|---|---|
| $5 individual monitoring | 200 | 6–12 months |
| $49 agency tier, ~25 domains | **21** | 60–90 days |

This is a product decision, not a marketing one, and it is the highest-leverage
item on this page. Everything below assumes it happens in week 3.

## Gates that must clear before any of it

From `schedule.md` and `README.md`, unchanged:

1. **The corpus study runs** (T-14). Until then every `[MEASURE]` in `press.md`
   is bracketed and nothing can be pitched.
2. **The methodology page is live** (T-12). *"Nothing is pitched before this is
   live."*
3. `PUBLIC_INDEX_LISTED` stays `false` until there are enough scored sites.
4. The handle is settled — `site.ts:111` says `@botready`, recent drafts say
   `@botreadyhq`. One of them is wrong on a shipped page.

## The channels, in order of expected return

Ranked by scans per hour of work, not by reach.

### 1. Launch directories — the best hours you will spend

Highest intent per visitor and they keep sending traffic for months. Product
Hunt is already fully written in `product-hunt.md`.

| | When | Notes |
|---|---|---|
| Product Hunt | Day 0, 00:01 PT | Six gallery frames written; slot 2 wants the real-time scan recording, still unbuilt |
| Hacker News — Show HN | Day 2, ~08:00 ET | Title: the finding, not the product. Be in the thread all day. |
| r/SideProject, r/webdev, r/SEO | Days 1–6, one per day | Post written; different framing per sub, never the same text twice |
| Indie Hackers | Day 1 | The build story, with the 57/100 self-scan |
| BetaList, Uneed, Peerlist, Dev Hunt, MicroLaunch | Week 1 | Cheap, additive, ~20 minutes each |
| llms.txt / AEO tool directories | Week 2 | Small but perfectly-qualified traffic |

### 2. X — the argument channel

`x.md` holds the nine-post launch thread and a month of standalone posts. The
posture there is right and does not need changing: post the evidence, get
argued with, answer everything. One measurement published per week, forever.

### 3. TikTok and Instagram — where the honest limit bites

Both reward a face and a voice. The campaign's rule, and your own decision
earlier in this project, is that no synthetic person represents this product.

**So the UGC here is you, not a generated creator.** A founder filming a
30-second "I scanned my own site and it got a C" is both permitted and better
performing than an AI presenter, which reads as synthetic to exactly the
audience most likely to try the tool.

What Higgsfield is genuinely for on these channels: the mascot skits — the
robot turned away at the door — as *interstitial* content, never as testimony.
One is rendered already (`out/hf-demo-3x4.mp4`), and `ui-short.mjs` produces the
product-led vertical cuts.

| Format | Source | Cadence |
|---|---|---|
| Founder to camera, 20–40s | You, phone | 3× per week |
| Product cut, silent, captioned | `ui-short.mjs` 9:16 | 2× per week |
| Mascot skit | Higgsfield, ~90 credits per 10s | 1× per week, budget permitting |
| Reels 1 and 3 | Already built | Week 1 |

### 4. Cold outbound — week 4, not week 1

Covered at length already: scan-first, never spray, and only after the
methodology page is live so the first email can cite a public method. lemlist is
connected and its domain warmup needs starting **now** even though nothing sends
until week 4.

### 5. Google Ads — smallest budget, tightest intent

`google-ads.md` is written. One conversion action: scan completed. Half budget
day 0, full budget only if cost-per-scan is defensible.

## The month

| Week | Aim | The work |
|---|---|---|
| **0** | Clear the gates | Corpus study; methodology page; fill every `[MEASURE]`; settle the handle; build the live-scan recording; start lemlist warmup |
| **1** | Launch | PH day 0; X thread; Show HN day 2; one Reddit post per day; the small directories; reels 1 and 3 |
| **2** | Sustain | First weekly measurement published; TikTok/IG cadence begins; remaining directories; answer everything |
| **3** | **Ship the agency tier** | $49 / 25 domains; LinkedIn agency post; direct outreach to 30 agencies using scans from the corpus study |
| **4** | Compound | Cold outbound opens; second measurement; Google Ads to full budget if the numbers justify it |

## What I can run, and what only you can

**Me, unattended:** every asset in `marketing/` and `marketing/video/`; the
scan-first outbound copy; scheduling through Metricool once a date and handle
exist; Higgsfield renders within a stated credit budget; the weekly measurement
write-up once there is data.

**You, unavoidably:** filming founder UGC; replying in comment threads under
your own name — `x.md` is explicit that being argued with in public is the point
and a bot answering a real objection would cost more than it earns; the agency
pricing decision; and anything that spends money.

## How this gets judged

`measurement.md` already names the four numbers, and they are the only ones
that count here. Add one:

**Monitoring attach rate — subscriptions ÷ fix packs sold.** It is the single
number that says whether $1k MRR is reachable at all, and we currently have no
idea what it is. If it comes in under 10% after fifty sales, the agency tier is
not an optimisation, it is the whole business.

## The honest summary

$1,000 in revenue next month: **likely**, with a good launch.

$1,000 MRR next month: **no.** The pricing cannot produce it at any traffic
volume you can reach in thirty days.

$1,000 MRR by month three: **yes, via 21 agencies rather than 200 founders** —
and the sooner that tier exists, the sooner every channel above is pointed at
someone who can actually produce it.
