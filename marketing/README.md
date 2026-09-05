# The launch campaign

Everything here is for one launch of one product, and it all argues one point.
Read this file before writing anything new in this directory, because the thing
that makes this campaign work is that eight channels say the same sentence in
eight registers rather than eight different things in one voice.

## Nothing here is invented

There are no numbers in this campaign that we have not measured, no customer
quotes we do not have, and no claim about the market that we cannot cite. Where
a number belongs and we do not have it yet, the copy carries `[MEASURE]` and it
must be filled from a real scan or a real query before it ships. Where a quote
belongs, it carries `[QUOTE NEEDED]`. Shipping either of those as-is would be
the worst possible outcome for a product whose whole argument is "this is
measurable, and here is the measurement".

Anything we do say has to survive a stranger checking it. That is not caution;
it is the same discipline as the scanner refusing to spoof a user agent. We are
selling a number. If the marketing exaggerates, the number is worthless.

## The one sentence

> Your site returns 200 to Chrome and 403 to ClaudeBot, in the same second,
> from the same IP address. Nobody decided that.

Everything else is support. Product Hunt, X, LinkedIn, Substack, Google,
Instagram, the press kit and the site itself all lead with a version of it. If
a draft does not get to that sentence inside two lines, it is not on brief.

The second sentence, which does the selling:

> The diagnosis is free and fully visible. The files that fix it are $15.

## Why anyone should care, in the order they will ask

1. **People ask assistants instead of searching.** Some of the answers name
   sites; some name yours. That share of your discovery has been quietly moving
   out of a channel you measure into one you do not.
2. **The clients that write those answers do not run your JavaScript, and half
   of them get refused at your edge.** Not by a decision — by a Cloudflare bot-
   fight preset, or a robots.txt blocklist somebody pasted off a forum in 2023.
3. **You cannot see this in your analytics,** because the requests that were
   refused never became sessions. It is invisible by construction.
4. **It takes thirty seconds to find out** and the answer is a status code, not
   an opinion.
5. **The fix is four files.** We generate them from your own scan.

## Who we are talking to, and what changes their mind

| Audience | Where | What they already believe | The line that moves them |
|---|---|---|---|
| Technical founder, 1–20 people | X, Product Hunt, Substack | "AEO is a grift" | It is one request and a status code. Argue with the weights, they are published. |
| Head of growth / SEO lead | LinkedIn, Google, press | "We need an AI visibility strategy" | Before strategy, check whether they can reach you at all. Free. |
| Platform / infra engineer | X, Product Hunt, /bot | "Bots are a cost centre" | Your WAF is refusing readers alongside scrapers. Here is which, and a rule that separates them. |
| Agency / consultant | LinkedIn, Substack | "I need something to sell" | A free scan is a first meeting. The fix pack is a deliverable with your name on it. |
| Journalist / newsletter writer | press kit | "Another AI SEO tool" | The published catalog and the refusal to evade a block are the story. So is the number of sites doing this by accident. |

## Voice, everywhere

The site's voice rules apply to the marketing without exception: active,
sentence case, plain. A claim states what happens. No em-dash-and-a-flourish, no
"unlock", no "supercharge", no "in today's AI-first landscape". We do not
capitalise Agent or AI Visibility as though they were products. We never
describe a competitor by name and we never describe an unnamed one snidely.

Two things we say in every register, because they are the moat:

- **The weights are published.** You can disagree with the score in public and
  we will publish the disagreement.
- **We never work around a block.** No spoofed user agent, no residential
  proxy, no captcha solving. If your site refuses our crawler, the result page
  says your site refuses our crawler, and that is the finding.

Two things we never say:

- That we know a site is losing traffic. We measure legibility, not revenue.
- That a high score causes citation. We are collecting the evidence for that
  and have not got it yet. Saying it before we have it would be the exact
  failure mode we sell against.

## The assets

| File | What is in it |
|---|---|
| `taglines.md` | The tagline bank, ranked, with where each one is cleared for use |
| `launch-kit.md` | **Start here on the day.** X and Product Hunt, in the order you paste it, no alternates |
| `product-hunt.md` | Listing, gallery, first comment, the replies to the five questions we will get |
| `x.md` | The launch thread, thirty standalone posts, the reply bank |
| `linkedin.md` | Founder post, company page, four follow-ups, comment starters |
| `substack.md` | Three essays; the first is written in full |
| `google-ads.md` | Campaign structure, keywords, RSA assets, negatives, landing pages |
| `instagram.md` | Two carousels, three reels, story frames, captions |
| `press.md` | Press kit, boilerplate, fact sheet, the pitch emails, embargo terms |
| `website.md` | What changes on botready.dev for launch week |
| `schedule.md` | The fourteen days, hour by hour on the day itself |
| `measurement.md` | What we count, and what we refuse to count |
| `assets/build.mjs` | Generates every graphic in this campaign as SVG |
| `video/` | The launch film, its cutdowns and the reels, and how they are built |

## The graphics

One visual idea, drawn twenty ways: **two status codes side by side.** A lime
`200` and a coral `403`, both stamped with the same timestamp and the same IP.
It works at 1080×1080, at 728×90, and as a favicon. Everything in
`assets/build.mjs` is a variation on it, in the site's own design system — 2px
ink borders, hard offset shadows with no blur, lavender ground — so an ad and
the product look like the same company made them.

```
node marketing/assets/build.mjs          # writes the SVGs
node marketing/assets/build.mjs --png    # also rasterises, needs Playwright
```

## What "launched" means

Not a spike. The scan is free and the result page is public, so the campaign's
job is to get one scan run by someone who will show the result to someone else.
Every asset ends in the same place: a URL box.
