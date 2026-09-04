# Making the score less arbitrary and more useful

The product's argument is that the weights are published so they can be argued
with. That only works if there is something to argue with. Today a careful
reader who goes looking finds assertions, and in two places finds a
contradiction. This is the plan to fix that.

Everything below preserves the four constraints that made the current
architecture worth having: evidence and scoring stay apart, the catalog stays
data rather than code, every score row records the version that produced it,
and the scanner never forms an opinion. Those decisions are what make this plan
cheap — every change here is a re-score of stored evidence, not a re-crawl of
the internet.

---

## What is actually arbitrary

Measured against the live catalog (v1.2, 21 checks, 111 points) and the
`waf-blocked-spa` fixture.

### 1. The same check is worth two different numbers on two pages

`/what-we-check` publishes `agent_status_parity — 18 points`, straight from
`checks.json`. The result page's findings list, for a scan where that check
fails, says `−13 pts`. Both numbers are correct and they come from the same
catalog. They disagree because `points` in the catalog is a **share within a
category**, while the findings list prints the **effect on the final 100**:

```
contribution = (check points / category points) × category weight
             = (18 / 35) × 25 = 12.86  →  −13
```

It has gone unnoticed because four of the six categories happen to have points
that sum exactly to their weight (representation 20/20, structure 15/15,
actionability 15/15, freshness 5/5) — for the 15 checks in those categories the
two numbers agree. Only retrievability (35 points for 25%) and discovery (21
for 20%) disagree, and those are the six checks that matter most.

| check | catalog says | costs you | agree? |
|---|---|---|---|
| `agent_status_parity` | 18 points | 12.9 | no |
| `js_dependency_ratio` | 11 points | 7.9 | no |
| `robots_agent_rules` | 8 points | 7.6 | no |
| `markdown_alternate` | 7 points | 7.0 | yes |
| `jsonld_present` | 6 points | 6.0 | yes |

This is the single most damaging thing on the list, because it is the one a
sceptical engineer will find first, on the page we invite them to argue with.

### 2. Thresholds are cliffs, and the cliff is worth four points

`js_dependency_ratio` fails above 0.7 and warns from 0.4. Scoring the same
fixture at a range of ratios:

| ratio | total |
|---|---|
| 0.39 | 58 |
| 0.40 | 54 |
| 0.699 | 54 |
| 0.701 | **50** |
| 0.99 | **50** |

Two defects in one table. A 0.002 change in a measured quantity moves the score
four points. And a page that is 70% JavaScript-dependent scores identically to
one that is 99% — past the threshold, the measurement stops mattering.

For the monitoring product this is worse than untidy: a site sitting near a
threshold will flip between two grades week to week and send an alert email
every time, for no change anyone made.

### 3. Retrievability is a slice when it is really a gate

A site that answers 403 to all four agents still earns its discovery,
representation, structure, actionability and freshness points and can score in
the fifties. But those five categories were measured with *our own* fetcher,
not with the agents that were refused. We are reporting "your JSON-LD is good"
about a site no agent can read. The number overstates, and it overstates
exactly in the case the product exists to make vivid.

### 4. Nothing connects the number to the outcome it claims to predict

The score claims to measure how legible a site is to the clients that answer
questions about it. Nothing in the system has ever checked whether a high score
corresponds to being cited. Until recently there was no way to; the
`prompt_runs` table now records, per prompt per week, which domains an
assistant's answer cited. That is ground truth arriving, and no part of the
scoring reads it.

### 5. A score has no context and no stated confidence

"62" alone is unreadable. Is that good? Compared with whom? And a total
computed from 21 of 21 checks looks identical to one computed from 16, with
three skipped and two errored — the second is a much weaker claim, and the page
says nothing.

### 6. The remaining hand-picked numbers

Grade bands at 85/70/55/35. `WARN_CREDIT = 0.5` flat, regardless of how near
passing a warn was. TTFB at 2500 ms, redirects at 3 hops. These are defensible
as first guesses and indefensible as permanent answers.

---

## Principles for the fix

1. **A published number must be the number that acts.** One meaning of
   "points", used everywhere.
2. **Continuous measurements get continuous scores.** A threshold may set the
   *status word*; it may not create a discontinuity in the *score*.
3. **The catalog stays data.** Every rule below is expressible as a declaration
   in `checks.json` that one generic scorer interprets. No new `if` per check.
4. **Every change is a version.** History is re-scored, never overwritten, and
   the change is published with its reasoning.
5. **Calibration informs; it does not decide.** Citation data will move weights,
   with the analysis published and its confounders named. It will not be fitted
   silently.

---

## S1 — Say why, and make the two numbers one number — **done**

**No arithmetic change. Scores did not move. Still v1.2.**

Shipped. It went in as `effectivePoints()` in `packages/core/src/catalog.ts`
rather than as the rescale this plan first proposed: rescaling would have
needed non-terminating decimals in the catalog (`18/35 × 25 = 90/7`) to stay
exact, and rounding them to something readable would have quietly changed every
score — which is the one thing S1 promised not to do. Keeping the catalog's
integers as within-category shares and publishing the derived contribution
everywhere gets the same result with no arithmetic risk. `checks.json` now
documents what `points` means, and the twenty-one rationales are published under
each check.

Verified: all five fixtures score exactly what they scored before, and a test
asserts for every check that its published number equals what the findings list
prints, that they sum to 100 across the catalog, and that they sum to each
category's weight within it.

Rescale each category's points so they sum to that category's weight. This is
provably a no-op on every score: a category's score is `earned / available`,
which is scale-invariant, and the category weights are untouched. Retrievability
becomes 12.9 / 7.9 / 2.1 / 2.1 instead of 18 / 11 / 3 / 3; the other five
categories mostly already satisfy this. After it, "points" means "of the final
100" everywhere, `pointsLost` agrees with the catalog by construction, and the
weights page and the result page stop contradicting each other.

Add a `rationale` string to every check and category — one or two sentences on
why this is measured and why it is worth what it is worth, including "this is a
first guess pending the calibration in S5" where that is the honest answer.
Publish it on `/what-we-check` under each check.

**Done:** `packages/core/__tests__/effective-points.test.ts` asserts the
equality for every check, the sum to 100, the sum to each weight, and that
nothing in the catalog is left without a rationale. `/what-we-check` publishes
the arithmetic, the rationales, and the honest note that the weights are still
estimates. Stored `scores` rows need no migration, because nothing they hold
changed.

## S2 — Continuous scoring and the retrievability gate (v1.3)

One version bump carrying both changes, because both renumber every score and
users deserve one migration and one announcement rather than two.

**Continuous scoring.** A check gains an optional `scoring` declaration:

```json
"scoring": { "type": "ramp", "field": "ratio", "full": 0.35, "zero": 0.85, "better": "lower" }
```

Credit becomes a continuous 0…1 interpolated between `full` and `zero`, rather
than 1 / 0.5 / 0. Checks with nothing to interpolate declare
`{"type": "binary"}` and behave exactly as today. The `status` word shown in the
interface is derived from the credit, so nothing in the UI changes shape. The
scorer gains one function that reads the declaration; it gains no knowledge of
any particular check.

This removes the cliff, makes 0.99 score worse than 0.71, and stops the
monitoring alerts that fire on a measurement wobbling across a line.

**The gate.** The catalog declares retrievability as a gate rather than a
slice:

```json
"gate": { "category": "retrievability", "mode": "ceiling" }
```

When agent clients are refused, the quality categories are still measured and
still shown — the diagnosis stays complete — but the headline number is capped
in proportion to how much of the site the agents could actually read, and the
page says so in a sentence: *"Scored out of 71, because three of five clients
could not read the page at all."* An honest ceiling is more useful than a
diluted average, and it makes the product's central finding structural instead
of merely heavily weighted.

**Done when:** the ratio sweep above is monotonic with no step larger than one
point; a blocked-for-all fixture cannot score above its ceiling; every existing
fixture has a recorded before/after total in the test suite; the whole `scores`
table is re-scored to v1.3 with v1.2 rows retained; and `/what-we-check`
publishes both the ramp endpoints and the gate.

## S3 — Context and confidence, on the page

**No arithmetic change.** Two things the reader needs that the data already
supports.

*Percentile within segment.* From the `scores` table at the same
scoring_version: "62 — 40th percentile of 180 SaaS sites we have scanned."
Computed nightly beside the index refresh, not per request.

*Coverage.* "All 21 checks contributed" or "17 of 21 — three skipped, one
errored", next to the grade, with the errored ones named. A score built on
fewer checks is a weaker claim and should look like one.

**Done when:** both appear on the result page, the share card, and the API
response; the percentile is absent rather than invented when the segment holds
fewer than 20 scored sites.

## S4 — Stop the alerts flapping

Scoring stays pure and per-scan; stability belongs to the alerting, not to the
arithmetic. `monitor-diff` gains hysteresis: alert on a total moving more than a
band, or on a category crossing in the same direction twice consecutively, and
always alert on a newly refused client regardless of size — that one is never
noise. S2 removes most of the flapping at the source; this covers the rest.

**Done when:** replaying a synthetic year of scans whose measurements jitter
inside one threshold band produces zero alerts, while a real regression in the
same series produces exactly one.

## S5 — Calibrate against citation (informs v1.4)

The long game, and the only thing that can make a weight non-arbitrary rather
than merely explained.

Join, per domain: its check results at a version, and its prompt-watch history
of whether assistants cited it. Report, per check, the association between
passing it and being cited. Publish the analysis — sample size, effect,
confidence, and the confounders by name: brand size dominates citation, the
sample is drawn from paying customers, and a correlation between passing a check
and being cited is not evidence that the check caused it.

Then propose weights as a versioned event, with the evidence beside the change,
and re-score history so the movement is visible rather than retroactive.

**Done when:** there are at least 12 weeks of prompt runs across at least 50
domains; the analysis is a committed, re-runnable script whose output is
published on `/what-we-check`; and any weight it moves cites it.

## S6 — Recalibrate the bands (with v1.4)

With a corpus, set the grade bands from the observed distribution and say what a
letter means — whether "A is the top decile of scanned sites" or an absolute
standard whose position in the distribution is at least published. Until then
the bands stay where they are and are labelled as a first guess.

---

## What this plan will not do

- **Let a model set a weight.** `ANTHROPIC_API_KEY` is for report prose. A
  weight is a published product decision with evidence attached.
- **Fit the weights tightly to citation data.** A score that maximises
  correlation with an outcome we also sell against becomes unfalsifiable, and
  the confounders are severe enough that a tight fit would be a lie told with
  arithmetic.
- **Hide the arithmetic behind a nicer number.** No curve exists to make a
  blocked site look mid-table.
- **Change what the scanner records.** Every improvement here is a different
  reading of the same evidence. That is the whole point of the split, and it
  means all of S1 to S4 can be applied to scans that have already run.

## Sequence

S1 is a day and buys the most credibility per hour, because it removes a real
contradiction rather than adding a feature. S2 is the substantive correctness
release and should not be split. S3 is presentation over data that already
exists and is the largest gain in usefulness for a reader. S4 waits on S2, which
removes most of its problem. S5 waits on data accumulating and should be started
now only insofar as making sure prompt runs are being recorded for every watched
domain. S6 is last because it needs the corpus S5 needs.

Nothing here requires a re-crawl.
