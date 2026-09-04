# Product Hunt

Launch on a Tuesday or Wednesday at 00:01 PT. Not Monday (the queue is full of
weekend leftovers), not Thursday or Friday (the day gets cut short by the
weekend for the second-day traffic that actually matters).

## The listing

**Name**
```
BotReady
```

**Tagline** (60 characters, and Product Hunt counts them)
```
See what AI agents see when they read your website
```
50 characters. Alternates, in order of preference:
```
Your site says 200 to Chrome and 403 to ClaudeBot        (54)
Check if AI assistants can actually read your site       (50)
The free check for whether AI agents can read your site  (55)
```

**Description** (260 characters)
```
Enter a URL. BotReady requests it as Chrome, ClaudeBot, GPTBot, PerplexityBot
and Google-Extended, one second apart from one IP, and shows you what each one
got back. 21 checks, published weights, free diagnosis. The files that fix it
are $15.
```

**Topics**: Developer Tools, SEO, Artificial Intelligence, Website Analysis,
Marketing

**Links**: `https://botready.dev` · pricing · `/what-we-check` · `/bot`

## The gallery

Six frames, in this order. Frame one has to work as a thumbnail with no words
read, which is why it is two status codes and nothing else.

| # | Asset | What it shows |
|---|---|---|
| 1 | `assets/ph-01-thumbnail.svg` | `200` in lime, `403` in coral, same timestamp, same IP. "Same site. Same second." |
| 2 | `assets/ph-02-result.svg` | A real result page. Grade, five client rows, the parity finding open. **Use a real scan.** |
| 3 | `assets/ph-03-catalog.svg` | The weights chart and four check cards. "Every weight is published so you can argue with it." |
| 4 | `assets/ph-04-fixpack.svg` | The five generated files as tabs, llms.txt open. "$15. Generated from your scan." |
| 5 | `assets/ph-05-refusal.svg` | The bot stopped at a 403 line. "We never work around a block." |
| 6 | `assets/ph-06-monitoring.svg` | The alert email. "It goes green, then a WAF update turns it red. You find out the same day." |

A 30-second screen recording goes in slot 2 if it is ready: type a URL, watch
the live page, land on the result. No music, no captions, real time — the scan
takes thirty seconds and pretending otherwise is a lie the first user catches.

## First comment

Post it within a minute of the listing going live.

```
Hi Product Hunt 👋

Six months ago I checked a client's site with curl and a spoofed user agent,
the way you do when something feels off. Chrome got a 200. ClaudeBot got a 403.
Same URL, same second, same IP address.

Nobody had decided that. It was a bot-fight preset in their WAF that had been
on for a year, and it did not know the difference between a scraper and a
client trying to answer a question about them. Their analytics could not show
it, because a request that gets refused never becomes a session.

I have found the same thing on a lot of sites since.

BotReady does that check properly. You give it a URL and it requests the page
as Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended — sequentially,
one second apart, from one address — then compares what each one got back. It
also asks the questions an agent asks before it reads your HTML: is there a
robots.txt rule quietly blocking readers while letting Googlebot through, is
there an llms.txt, is your pricing readable without running JavaScript, is your
structured data actually there.

21 checks, six categories, and every weight is published at /what-we-check with
the reasoning under it. The score is a pure function of the evidence, so when
we change a weight we re-score history rather than quietly rewriting it.

Three things I decided early and will not move on:

1. The scanner never works around a block. No spoofed user agents, no
   residential proxies, no captcha solving. If your site refuses our crawler,
   the result says your site refuses our crawler, and that is the finding — the
   whole number is worthless if we cheat to get it.
2. The diagnosis is free and never blurred. Everything we found, in full,
   without an account. You can fix all of it yourself and never pay us.
3. Max six pages per scan, sequential, a second apart. We are a diagnostic
   tool, not a load generator.

The paid part is the fix pack: $15 for the files generated from your own scan —
an llms.txt built only from URLs we confirmed return 200, a robots.txt patch, a
WAF rule that separates readers from scrapers, the JSON-LD you are missing, and
a prompt you can paste into a coding agent for the rest. Monitoring is $5/month
and emails you the day a client that could read you stops being able to.

Run it on your own site. It takes thirty seconds and I would genuinely rather
you came back and told me a check is wrong — a check that fires on a correctly
configured site is my bug, and I will fix it and say so.

— Deacon
```

## The replies we will need

Draft them now. On launch day you are answering in ninety seconds or not at all.

**"Isn't this just SEO?"**
```
Different failure mode. SEO is about ranking among pages a crawler already
fetched successfully. This is about the fetch: Googlebot gets through your edge
and ClaudeBot does not, so you can be perfectly optimised and still absent from
the answer. The overlap is real — structured data helps both — but the headline
check has no SEO equivalent, because search crawlers are almost never the ones
being refused.
```

**"How is this different from [AI visibility tool]?"**
```
Two things, and they are both about what we will not do. We publish every
weight and the reasoning under it, so you can tell us the score is wrong and we
have to answer. And we never evade a block to get a reading — a lot of tools
quietly spoof a browser user agent, which produces a nicer-looking number about
a site that agents genuinely cannot read.

The other difference is the shape: we are a diagnostic that sells you files,
not a dashboard that sells you a subscription. The scan is free and complete.
```

**"Can you actually prove a high score gets you cited?"**
```
No, and I am not going to claim it. Nobody has that evidence yet, us included.
What I can defend is narrower: these clients cannot read a page they were
refused, and cannot see text that only exists after JavaScript runs. That is a
status code and a character count, not a theory.

We have started recording, per prompt per week, which domains an assistant's
answer actually cites. When there is enough of it I will publish the analysis —
including the confounders, of which brand size is the big one — and if it says
our weights are wrong, that gets published too. It is written down as S5 in
SCORING-PLAN.md in the repo.
```

**"Doesn't blocking AI crawlers protect my content?"**
```
It might be exactly the right call, and if it is, we say so rather than marking
you down for a decision you made. What the check is really looking for is the
site that blocks reading agents while leaving Googlebot alone — that pattern is
almost never deliberate, it is what you get from a pasted blocklist or a WAF
preset. If you refuse everyone, we record it as a decision. If you refuse the
readers and welcome the crawlers, you probably want to know.
```

**"What do you do with my data?"**
```
Status codes, header values, character counts, page titles. We keep the
readable text of a page only for as long as the scan takes to compute a ratio
from it, and we train nothing. The result page is public because a link to it
is the product, and if you claim the domain you can take it out of the public
index. It is all written out on /bot.
```

**"Why $15?"**
```
It is the price of the files, once, for one scan. The diagnosis it came from is
free and complete, so you are paying to not spend an afternoon writing an
llms.txt and working out which Cloudflare rule to change. If the pack is wrong
about your site, write to me and I refund it — I would rather hear about the
bad scan.
```

## Hunter outreach

Send four days ahead. Short, one ask, no attachments.

```
Subject: Would you hunt this? 30-second demo

Hi [name],

I built BotReady — you paste a URL and it requests the page as Chrome,
ClaudeBot, GPTBot, PerplexityBot and Google-Extended a second apart, then shows
you what each one got back. The finding it exists for is a site returning 200 to
a browser and 403 to a reading agent from the same IP in the same second, which
turns out to be common and almost never deliberate.

Try it on your own site: https://botready.dev — it takes thirty seconds and
costs nothing.

If it is interesting I would love you to hunt it on [date]. If it is not, I would
still like to know which check you think is wrong.

— Deacon
```

## Launch day, the parts people forget

- Do not ask for upvotes anywhere. Ask people to run a scan. The result page is
  public and shareable; that is the loop.
- Reply to every comment, including the dismissive ones, within the hour. A
  well-argued disagreement in the thread is worth more than five compliments.
- If someone posts a result showing their own site is blocked, ask if you can
  quote it, and do not use it until they say yes.
- Keep `[MEASURE]` out of the listing. If you cannot fill a number by launch
  morning, cut the sentence.
