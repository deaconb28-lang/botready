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
| Agency — 10 domains | $29 | **per month** |

So `$1,000 MRR ÷ $29 = 35 accounts`. That is the whole target, and it is a
very different number from the one this file was first written against.

**The $29 tier changed the shape of the problem.** At $5 for three domains it
took 200 subscribers, which needed upwards of 40,000 scans in a month — off by
more than an order of magnitude from anything a launch produces. At $29 for ten:

| | Subscribers for $1k MRR | Scans needed, at 10% attach and 3% conversion |
|---|---|---|
| Old $5 plan | 200 | ~44,400 |
| **New $29 plan** | **35** | **~11,700** |

Still roughly five times the traffic that produces $1,000 of one-time revenue,
but no longer in a different universe from it.

**And the funnel is no longer the only route.** 200 people had to be *found*;
35 accounts can be *sold to*. That is the real consequence of the repricing and
it moves outbound from a week-4 experiment to the primary MRR channel — see the
month below.

**Every conversion rate here is an assumption, not a measurement.** The four
numbers in `measurement.md` are all currently zero. Replace these the moment
there are real ones.

## The two targets

**Month 1 — $1,000 in total revenue.** 67 fix packs, about 2,200 scans at 3%.
A good launch month, achievable with the channels below.

**$1,000 MRR — 60 to 90 days, and mostly sold rather than converted.** 35
agency accounts. Some will come up the funnel from a fix pack; most will come
from talking to agencies directly, because an agency does not usually discover
a tool by scanning its own marketing site.

## The gap the repricing opened

A solo founder with one site now has nothing to buy monthly. $29 for ten
domains is the wrong shape for them, and they were the audience every piece of
copy in this directory is written for.

That is survivable — they buy the $15 pack and leave, which is the one-time
revenue in target one — but it should be a deliberate position rather than an
accident. If the monitoring attach rate for single-site owners turns out to
matter, the answer is a cheap single-domain watch, not a discount on agency.

## What the agency tier still needs

It is on the pricing page and priced in code. Two things are unfinished:

1. **The $29 price does not exist in Stripe.** Checkout builds a correctly
   priced Session from `PRICING`, but `STRIPE_LINK_MONITOR` has no value and
   the fallback is deliberately disabled rather than pointed at the old $5
   link. Create the price, set the variable.
2. **Nothing in the product is agency-shaped yet.** One alert feed across ten
   client domains is sold on the pricing page; check it behaves that way before
   an agency is looking at it.

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

### 4. Scan-first outbound — the MRR engine, not an afterthought

This moved up the list when the price changed. 35 agency accounts is a sales
target, and agencies are reached by being told something specific about a client
of theirs — not by discovering a scanner.

Still never spray, and still not before the methodology page is live. The shape
is unchanged: scan a prospect's client site, lead with what four of five clients
got, link the public result page. lemlist is connected and its domain warmup
needs starting **now**, because it takes three to four weeks and week 2 is when
the first approaches should go out.

### 5. Google Ads — smallest budget, tightest intent

`google-ads.md` is written. One conversion action: scan completed. Half budget
day 0, full budget only if cost-per-scan is defensible.

## The month

| Week | Aim | The work |
|---|---|---|
| **0** | Clear the gates | Corpus study; methodology page; fill every `[MEASURE]`; settle the handle; build the live-scan recording; start lemlist warmup |
| **1** | Launch | PH day 0; X thread; Show HN day 2; one Reddit post per day; the small directories; reels 1 and 3 |
| **2** | Sustain **and start selling agencies** | The tier is already shipped, so this is outreach, not building: LinkedIn agency post, and scan-first approaches to agencies using results from the corpus study; first weekly measurement published; TikTok/IG cadence begins; remaining directories |
| **3** | Agency push | 30 direct approaches, each led with a real scan of one of their client sites; first agency calls |
| **4** | Compound | Second measurement; Google Ads to full budget if cost-per-scan justifies it |

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

**Agency attach rate — subscriptions ÷ fix packs sold.** We have no idea what it
is, and it decides how much of the 35 has to be sold rather than converted. Under
10% after fifty fix packs means the funnel will not carry it and outbound is the
whole motion, not half of it.

Worth watching alongside it: **how many of those 35 came from a scan versus from
a conversation.** If it is overwhelmingly conversations, the marketing in this
directory is doing a different job — earning the credibility that makes an
outbound email answerable — and should be judged that way rather than on scans.

## The honest summary

$1,000 in revenue next month: **likely**, with a good launch.

$1,000 MRR next month: **still no**, but it is no longer absurd. 35 accounts is
a number you could name the customers for, which 200 never was.

$1,000 MRR by month three: **yes, and the tier now exists to carry it.** The
work is selling to 35 agencies, which is an outbound motion starting in week 2,
not a traffic problem waiting on virality.
