# Explee — the company pitch

Explee builds its account list from how you describe yourself, so this file is
not brochure copy. It is the input the model reads to decide which companies get
approached, and every sentence here does double duty: it has to sell, and it has
to be specific enough that a machine can extract an ICP from it.

Salesy, in this file, means **specific**. The house rules in `README.md` still
hold — no "unlock", no "supercharge", no "AI-first landscape", and nothing we
have not measured. What sells here is that the claim is checkable in thirty
seconds. Hype is what you write when you cannot show the status code.

---

## The pitch, at four lengths

Use the shortest one that fills the field.

### One line

> BotReady shows a site owner which AI agents get refused at their front door,
> then generates the files that fix it.

### 25 words — the elevator field

> Your site returns 200 to Chrome and 403 to ClaudeBot, in the same second, from
> the same IP. BotReady finds that in thirty seconds and fixes it for $15.

### 60 words — the standard company description

> People ask assistants instead of searching, and the clients writing those
> answers do not run your JavaScript — half of them get refused at your edge by a
> bot-fight preset nobody chose. Your analytics cannot show you this, because a
> refused request never became a session. BotReady asks your site the way an
> agent would, scores what came back against twenty-one published checks, and
> hands you the files that fix it.

### 150 words — the long field, and the one Explee reasons over

> Discovery is moving into a channel you do not measure. When someone asks an
> assistant about your category, something has to fetch your site to answer — and
> those clients do not execute JavaScript, do not wait for a challenge page, and
> are frequently refused outright by a WAF preset or a robots.txt line pasted off
> a forum in 2023. Nobody decided that. It is invisible by construction, because
> the requests that got refused never became sessions in your analytics.
>
> BotReady fetches your URL as several different clients at once and compares
> what each one got back. The headline finding is a comparison, not an opinion:
> 200 for Chrome, 403 for ClaudeBot, same second, same IP address. Twenty-one
> checks across six categories, every weight published so you can argue with the
> score in public.
>
> The diagnosis is free and fully visible. The files that fix it are $15.

---

## Capabilities, in the form Explee can parse

Written flat and factual on purpose — this is the section that becomes search
criteria, not the section that gets read aloud.

**What it does**

- Fetches a URL as multiple clients — a real browser, a plain HTTP client, and
  named agent user-agents — from one IP within the same window, then compares the
  responses.
- Runs 21 checks across 6 categories: retrievability, discovery, representation,
  structure, actionability, freshness. Weights are published on the site.
- Returns a 0–100 score and an A–F grade, every check listed with the raw
  evidence — status codes, byte counts, header values — not a summary.
- Renders a public, shareable result page for any domain. No login, no blurred
  numbers behind a paywall.
- Generates the fix as real files: `llms.txt`, a corrected `robots.txt`, a WAF
  rule that separates readers from scrapers, JSON-LD, a markdown alternate, a
  punchlist, and a prompt you can hand to a coding agent.
- Re-scans on a schedule and reports what changed, at up to 10 domains per
  account.

**What it refuses to do, which is the differentiator**

- It never works around a block. No spoofed user agent, no residential proxy, no
  captcha solving. If a site refuses our crawler, the result page says the site
  refuses our crawler — that *is* the finding.
- It never claims a site is losing traffic. We measure legibility, not revenue.
- It never claims a high score causes a citation. We are collecting that evidence
  and do not have it yet.

Lead with the refusals when the prospect is technical. An engineer who has been
pitched three AEO tools this quarter has heard every promise and no constraints;
the constraints are what make the number worth having.

**Commercially**

| | |
|---|---|
| Scan and full diagnosis | Free, no account, permanently public |
| Fix pack | $15 one time, $5 per extra domain |
| Agency | $29/month, up to 10 domains, scheduled re-scans |
| Enterprise | From $1,000/month |

---

## Who to approach, in priority order

The agency tier carries the revenue target, so agencies are the primary list.
Everything else is secondary.

**1. Agencies and consultants — SEO, growth, web development, 2–50 people.**
They need something to sell that is not another retainer line item. A free scan
of a client's site is a first meeting that opens itself, and the fix pack is a
deliverable with their name on it. $29 covers ten client domains, which is the
whole pitch: it costs less than one hour of their time and it monitors their
entire book.

**2. Heads of growth and SEO leads at companies with 20–200 people.**
They already believe they need an AI visibility strategy. The line that moves
them: before strategy, check whether those clients can reach you at all. Free.

**3. Technical founders, 1–20 people.**
They believe AEO is a grift, and they are mostly right. It is one request and a
status code. The weights are published — argue with them.

**4. Platform and infrastructure engineers.**
They own the WAF that is doing this. They think of bots as a cost centre. Show
them their edge is refusing readers alongside scrapers, and hand them the rule
that separates the two.

### Signals worth hunting

- Agencies publishing an AEO, GEO, or "AI search visibility" service page — they
  are already selling this and have nothing to measure it with.
- Job postings mentioning AI search visibility, LLM SEO, or answer-engine
  optimisation.
- Sites on Cloudflare with an aggressive bot-fight posture, or a recent migration
  to Webflow, Framer, or Shopify — configuration changes are when this breaks.
- Sites with no `llms.txt` and heavy client-side rendering.

---

## The opening line, and why it is not a template

The one thing that makes this outbound work instead of landing in spam: **scan
them first.** Not the prospect's own site — a client's. Lead with what you found,
link the public result page, and let the page do the selling. There is no version
of this that works as a merge field.

Shape:

> Ran [CLIENT DOMAIN] through a scan that fetches a page the way an assistant's
> crawler does. It returns 200 to Chrome and [STATUS] to ClaudeBot from the same
> IP. Result page, nothing gated: [URL]. Four of the five [CLIENT] sites I
> checked did the same thing.

`[MEASURE]` — the "four of five" needs to be a real count from real scans before
a single send. Filling it with a plausible number would be the exact failure mode
this product sells against, and it is the one thing here that would be fatal if a
prospect checked.

---

## Guardrails for anything Explee generates

Generated variants will drift toward the two claims we do not make, because they
are the obvious things to say. Reject any draft that:

- says or implies the prospect is **losing traffic, revenue, or customers**;
- promises **more citations, better AI rankings, or being recommended** by an
  assistant;
- carries a **percentage, multiple, or dollar figure** that is not traceable to a
  scan we ran;
- names a competitor, or gestures at an unnamed one snidely;
- opens with anything other than a specific finding about a specific domain.

The whole product is a measurement. If the email exaggerates, the measurement is
worthless, and the first prospect who checks will say so in public.
