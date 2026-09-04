# Google Ads

The one channel here where the reader is already looking for something. That
makes it the cheapest place to be honest: describe the free scan accurately and
let the product do the qualifying.

Budget shape for month one: **$40/day**, split 70/20/10 across the three search
campaigns below, with display dark until search has a cost per scan we believe.
Do not turn on Performance Max. It will spend the budget on nothing measurable
and you will not be able to tell what happened.

## Campaign structure

### 1 — Problem aware (70%)

People who already know the phrase. Exact and phrase match only.

```
[llms.txt]                       [llms txt generator]
[llms.txt checker]               [does chatgpt see my website]
[is my site blocking gptbot]     [claudebot 403]
[gptbot blocked]                 [ai crawler blocked by cloudflare]
[check if ai can read my website] [ai crawler test]
[does perplexity index my site]  [robots.txt ai crawlers]
```

### 2 — Category aware (20%)

The jargon. More expensive, worse intent, but they will find us anyway and it is
better to be there with an honest ad than absent.

```
"answer engine optimization"     "generative engine optimization"
"aeo tool"                       "geo seo tool"
"ai visibility tool"             "llm seo audit"
"ai search optimization"         "chatgpt seo"
```

### 3 — Adjacent technical (10%)

Broad enough to find the infra engineer who has not connected the two ideas yet.

```
"user agent 403 debug"           "cloudflare bot fight mode blocking"
"server side rendering seo check" "structured data validator"
```

## Negative keywords

Apply at account level. These are what stop the budget going to nothing.

```
-free tools list      -course        -jobs         -salary
-what is             -meaning       -wikipedia    -reddit karma
-generator ai image  -bot maker     -telegram     -discord bot
-scraper             -scraping api  -proxy        -captcha solver
-buy backlinks       -guest post    -pbn          -cheap seo
-chatgpt login       -claude login  -download
```

`-scraper`, `-proxy` and `-captcha solver` matter more than the rest: that
traffic is looking for the opposite of what we sell and will click anyway.

## Responsive search ads

### Ad group: llms.txt

**Headlines** (30 characters)
```
Free llms.txt checker
Check your llms.txt in 30s
Is your llms.txt working?
llms.txt, checked and fixed
See what agents see
21 checks, published weights
Free scan, no signup
Fix files for $15
Your llms.txt may be broken
Half the links may 404
```

**Descriptions** (90 characters)
```
We fetch your llms.txt, open the links, and tell you which ones are dead. Free, no account.
Then we generate a new one from URLs we confirmed return 200. $15, one time.
21 checks across 6 categories. Every weight published so you can argue with the score.
The diagnosis is free and never blurred. Nothing is hidden behind a payment.
```

### Ad group: blocked crawlers

**Headlines**
```
Is your site blocking AI?
403 to ClaudeBot?
Check what GPTBot sees
Chrome 200. ClaudeBot 403.
Your WAF may be refusing AI
Find out in 30 seconds
Free crawler access check
Test 5 clients at once
Your analytics can't show it
```

**Descriptions**
```
We request your page as 5 clients, one second apart, and show you all 5 answers. Free.
A refused request never becomes a session, so no analytics product will ever show you it.
If a rule is blocking readers but not Googlebot, that is almost never deliberate. We find it.
Free diagnosis, published weights, and a WAF rule that separates readers from scrapers.
```

### Ad group: AEO / GEO

**Headlines**
```
AEO, but measurable
21 checks. Published weights.
Score, don't guess
Free AI readability scan
The diagnosis is free
Argue with our weights
Not a dashboard. A check.
```

**Descriptions**
```
Every weight is published with the reasoning under it. A score you can't argue with is a horoscope.
We never spoof a user agent to get past a block. If a site refuses us, the result says so.
Free, complete diagnosis. The $15 buys the generated files, not the answer.
```

## Sitelinks

| Link | Description |
|---|---|
| What we check | 21 checks, 6 categories, every weight published |
| Pricing | Free diagnosis. $15 fix pack. $5/mo monitoring. |
| Our crawler | What BotreadyBot requests and how to block it |
| API and docs | Public scan API. No key, no account. |

## Callouts

`Free diagnosis` · `No account needed` · `Published weights` · `30-second scan`
· `Never evades a block` · `Refund if we're wrong`

## Structured snippet

Header: *Service catalog* — `Crawler access` `JavaScript dependency` `llms.txt`
`Structured data` `Sitemap health` `Cache headers`

## Landing pages

Never send an ad to the home page when a specific page exists.

| Ad group | Lands on |
|---|---|
| llms.txt | `/what-we-check#discovery` |
| blocked crawlers | `/` (the URL box is the first thing) |
| AEO / GEO | `/what-we-check` |
| adjacent technical | `/bot` |

## Display, when it is turned on

Sizes generated by `assets/build.mjs`: 300×250, 336×280, 728×90, 300×600,
160×600, 320×50.

One creative idea, no variations to test at this budget: the lime `200` and the
coral `403` side by side, one line of type, a URL box drawn as a button. Placement
exclusions on everything user-generated.

## What we will not run

- **Competitor brand terms.** We are arguing that this category should be
  checkable; bidding on a rival's name to intercept them is the opposite habit.
- **"AI traffic" or "get cited" ad copy.** We cannot promise citation. An ad is
  not the place to start.
- **Any headline with a number we have not measured.** If an RSA asset needs a
  statistic, cut the asset.
