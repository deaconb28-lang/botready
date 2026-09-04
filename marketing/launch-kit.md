# Launch kit — X and Product Hunt

Everything for the two channels, in the order you paste it. No alternates, no
rationale, nothing to decide on the morning. `x.md` and `product-hunt.md` are
where the thinking is and where the options live; this is the thing you keep
open on the day.

Assets are in `assets/out/`, regenerate with `node marketing/assets/build.mjs --png`.

---

## Before you start

Four things, and the launch is worse without each of them.

- [ ] **Run a real scan and screenshot it.** `ph-02-result.png` is a drawing.
      Replace it with a genuine result — a site that returns 200 to Chrome and
      403 to a reading agent is the whole pitch, and a mock of one is not.
- [ ] **Check your own score.** We scanned botready.dev, got 57 and a C, fixed
      the seven failing checks and published what changed. That story is in
      several posts below. Re-run it and use the number you actually have.
- [ ] **Google sign-in works.** It is the only way in now. Test it end to end,
      in a private window, with an account you have never used.
- [ ] **The `/index/saas` page has rows on it.** Two posts point at it.

Everything below is true as written. If any of it stops being true, cut the
line rather than softening it.

---

## Product Hunt

### The listing

**Name** — `BotReady`

**Tagline** (50 chars)
```
See what AI agents see when they read your website
```

**Description** (260 chars)
```
Enter a URL. BotReady requests it as Chrome, ClaudeBot, GPTBot, PerplexityBot
and Google-Extended, one second apart from one IP, and shows you what each one
got back. 21 checks, published weights, free diagnosis. The files that fix it
are $15.
```

**Topics** — Developer Tools, SEO, Artificial Intelligence, Website Analysis

**Links** — `https://www.botready.dev` · `/pricing` · `/what-we-check` · `/bot`

**Thumbnail** — `assets/out/ph-thumbnail.png` (240×240)

### Gallery, in this order

| # | File | Why it is here |
|---|---|---|
| 1 | `ph-01-cover.png` | Two status codes, nothing else. It has to work as a thumbnail with no words read. |
| 2 | **a real screenshot** | The result page. Replace the drawn `ph-02-result.png`. |
| 3 | `ph-03-catalog.png` | The published weights. This is the differentiator, so it goes third. |
| 4 | `ph-04-fixpack.png` | What $15 buys. |
| 5 | `ph-05-refusal.png` | We never work around a block. |
| 6 | `ph-06-monitoring.png` | The $5 recurring line. |

If the 30-second screen recording is ready it goes in slot 2 and the screenshot
moves to 3. Real time, no music — the scan takes thirty seconds and speeding it
up is the first lie a user catches.

### First comment — post within 60 seconds

```
Hi Product Hunt 👋

Six months ago I checked a client's site with curl and a few different user
agents, the way you do when something feels off. Chrome got a 200. ClaudeBot got
a 403. Same URL, same second, same IP address.

Nobody had decided that. It was a bot-fight preset in their WAF that had been on
for a year, and it could not tell the difference between a scraper and a client
trying to answer a question about them. Their analytics could not show it,
because a request that gets refused never becomes a session. Search Console was
green — Googlebot was getting through fine.

I have found the same thing on a lot of sites since.

BotReady does that check properly. You give it a URL and it requests the page as
Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended — sequentially, one
second apart, from one address — then compares what each one got back. It also
asks what an agent asks before it reads your HTML: is a robots.txt rule quietly
blocking readers while letting Googlebot through, is there an llms.txt, is your
pricing readable without running JavaScript, is your structured data actually in
the response or only after hydration.

21 checks, six categories, and every weight is published at /what-we-check with
the reasoning under it. The score is a pure function of the evidence, so when we
change a weight we re-score history rather than quietly rewriting it.

Three things I decided early and will not move on:

1. The scanner never works around a block. No spoofed user agents, no
   residential proxies, no captcha solving. If your site refuses our crawler,
   the result says your site refuses our crawler. The whole number is worthless
   if we cheat to get it.
2. The diagnosis is free and never blurred. Everything we found, in full,
   without an account. You can fix all of it yourself and never pay me.
3. Max six pages per scan, sequential, a second apart. A diagnostic tool, not a
   load generator.

The paid part is the fix pack: $15 for the files generated from your own scan —
an llms.txt built only from URLs we confirmed return 200, a robots.txt patch, a
WAF rule that separates readers from scrapers, the JSON-LD you are missing, and
a prompt to paste into a coding agent for the rest. Monitoring is $5/month and
emails you the day a client that could read you stops being able to.

One more thing, since it is the fairest test of whether I mean any of this: I
scanned botready.dev with its own scanner and it came back 57 out of 100, a C.
Seven checks failed. I fixed them the same day and the write-up of what was
wrong is in the repo.

Run it on your own site. Thirty seconds, no account, and I would genuinely
rather you came back and told me a check is wrong — a check that fires on a
correctly configured site is my bug, and I will fix it and say so.

— Deacon
```

### Replies — have these open in a second window

**"Isn't this just SEO?"**
```
Different failure. SEO is about ranking among pages a crawler already fetched
successfully. This is about the fetch: Googlebot gets through your edge and
ClaudeBot does not, so you can be perfectly optimised and still absent from the
answer. Almost nobody's WAF refuses Googlebot, which is why there is no SEO
equivalent of the headline check.
```

**"How is this different from the other AI visibility tools?"**
```
Two things, both about what we will not do. We publish every weight and the
reasoning under it, so you can tell us the score is wrong and we have to answer
in public. And we never evade a block to get a reading — spoofing a browser user
agent produces a nicer-looking number about a site agents genuinely cannot read.

The shape is different too: a diagnostic that sells you files, not a dashboard
that sells you a subscription. The scan is free and complete.
```

**"Can you prove a high score gets you cited?"**
```
No, and I will not claim it. Nobody has that evidence, us included. What I can
defend is narrower: these clients cannot read a page they were refused, and
cannot see text that only exists after JavaScript runs. That is a status code
and a character count, not a theory.

We have started recording which domains an assistant's answer actually cites,
per prompt per week. When there is enough of it I will publish the analysis —
confounders included, and brand size is the big one — and if it says our weights
are wrong, that gets published too. It is written down as S5 in SCORING-PLAN.md.
```

**"Blocking AI crawlers protects my content."**
```
It might be exactly right, and if it is we record it as a decision rather than
marking you down for it. What the check is really looking for is the site that
blocks reading agents while leaving Googlebot alone — that pattern is almost
never deliberate. Refuse everyone and we say so. Refuse the readers and welcome
the crawlers and you probably want to know.
```

**"What do you do with my data?"**
```
Status codes, header values, character counts, page titles. The readable text of
a page is kept only as long as the scan takes to compute a ratio from it, and we
train nothing. The result page is public because a link to it is the product,
and claiming the domain lets you take it out of the public index. All of it is
written out on /bot.
```

**"Why $15?"**
```
It is the price of the files, once, for one scan. The diagnosis they came from
is free and complete, so you are paying not to spend an afternoon writing an
llms.txt and working out which Cloudflare rule to change. If the pack is wrong
about your site, write to me and I refund it — I would rather hear about the bad
scan.
```

---

## X

### The thread — post all nine in one sitting

**1/** — attach `assets/out/x-card.png`
```
Your website probably returns 200 to Chrome and 403 to ClaudeBot.

Same URL. Same second. Same IP address.

Nobody decided that. I built a thing that finds it in 30 seconds, free:
botready.dev
```

**2/**
```
Here is how it happens.

Someone turns on a bot-fight preset in Cloudflare. Or pastes a robots.txt
blocklist off a forum. Or adds a rule after a scraping incident in 2023.

None of those know the difference between a scraper and a client trying to
answer a question about you.
```

**3/** — attach `assets/out/x-post-curl.png`
```
And you cannot see it.

A refused request never becomes a session, so it is not in your analytics.
Search Console is green — Googlebot went through fine.

The only way to know is to make the request yourself, as each client, and
compare.
```

**4/**
```
So that is what BotReady does.

It requests your page five times — Chrome as the control, then ClaudeBot,
GPTBot, PerplexityBot, Google-Extended — sequentially, one second apart, from
one address.

Then it puts the five status codes next to each other.
```

**5/**
```
It also asks what an agent asks before it reads your HTML:

· is a robots.txt rule blocking readers but not Googlebot
· is there an llms.txt
· is your pricing readable without running JS
· is your JSON-LD in the response, or only after hydration
```

**6/** — attach `assets/out/x-post-weights.png`
```
21 checks, six categories, one score out of 100.

Every weight is published at botready.dev/what-we-check with the reasoning under
it, because a score nobody can argue with is a horoscope.

Think a weight is wrong? Tell me and I have to answer in public.
```

**7/** — attach `assets/out/x-post-refusal.png`
```
Two rules I will not move on.

The scanner never works around a block. No spoofed user agents, no residential
proxies, no captcha solving. If your site refuses our crawler, the result says
so, and that is the finding.

A number you cheated to get is worth nothing.
```

**8/**
```
And the diagnosis is free. All of it. Never blurred, no account.

You can read every finding and fix every one of them yourself and never pay me
a cent.

$15 buys the generated files if you would rather not spend the afternoon.
```

**9/**
```
Run it on your own site. Thirty seconds, no account:

botready.dev

If it comes back green, good — close the tab. If a check fires on a site you
know is configured correctly, that is my bug and I want to hear about it.
```

### Launch-day follow-up — around 15:00, once there are real scans

Not a bump. Something you learned from the day.
```
[N] people have run a scan today. The single most common failure so far is
[the finding].

Not the exotic one I expected. Just [one sentence about what it actually was].
```
Fill both brackets from real numbers or do not post it.

### The next two weeks — one a day, each stands alone

1. `curl -A "ClaudeBot" https://yoursite.com` — if that returns anything other
   than what your browser gets, you have a problem your analytics cannot show you.
2. The scariest line in a scan result is not a low score. It is two rows next to
   each other: `chrome 200` and `claudebot 403`, timestamps one second apart.
3. Nobody has ever sat in a meeting and decided to block ChatGPT from reading
   their pricing page. It happens to sites every week anyway.
4. "We do not block AI crawlers." Neither did any of the sites I have found
   blocking AI crawlers. A preset is not a decision, but the 403 is identical.
5. Search Console will never show you this. Googlebot got through. It is the
   other four that did not.
6. If your prices are rendered by React and nothing is in the initial response,
   a client that does not run JavaScript sees a page about a company with no
   prices. Not a wrong price. No price.
7. There is a number in every scan I like more than the score: raw characters
   against rendered characters. When the first is 8% of the second, the page is
   an application pretending to be a document.
8. Server-render the words. That is the whole trick. The other checks are worth
   75 points between them and this one habit moves most of the other 25.
9. A bad llms.txt is worse than none. If half the links 404, a client that
   trusted it spent its budget on your dead ends and learns not to trust the
   convention.
10. Serve your pages as markdown when a client sends `Accept: text/markdown`. We
    do — botready.dev/pricing.md, generated from the same data the HTML renders,
    so the two cannot disagree.
11. We scanned our own site with our own scanner and got 57 out of 100. Seven
    checks failed. Fixed them the same day and published what changed.
12. Two of our published numbers disagreed for months: the catalog said a check
    was worth 18 points, the findings list said 13. Both read the same file. Both
    were right. We fixed it and wrote up why.
13. A threshold that turns 0.699 into one grade and 0.701 into another is not a
    measurement, it is a cliff. We know. It is written down as the next thing to
    fix, with the numbers.
14. Two lines in your robots.txt and we stop, permanently, on every future scan:
    `User-agent: BotreadyBot` / `Disallow: /`. No form, no list to be removed from.

### Replies

**"This is just SEO with extra steps."**
```
Related, different failure. SEO is about ranking among pages that were fetched
successfully. This is about the fetch. Almost nobody's WAF refuses Googlebot,
which is why there is no SEO equivalent of the headline check.
```

**"AI search is a fad."**
```
Might be. The check costs thirty seconds and nothing, and half of what it finds
— server-rendered text, real structured data, a sitemap with honest dates — is
worth having whether or not you are right.
```

**"You are fearmongering to sell a $15 file."**
```
Fair challenge. The diagnosis is free and unblurred — read every finding and fix
all of it without paying. And I will not claim a high score gets you cited,
because nobody has that evidence. What I claim is narrower: a refused client
cannot read you, and a client that does not run JS cannot see text that only
exists after hydration. Both checkable in your own terminal.
```

**"Scanned my site, the [x] check is wrong."**
```
Send me the scan URL. A check that fires on a correctly configured site is my
bug and I would rather fix it than argue about it.
```

---

## Profile

- **X header** — `assets/out/x-header.png` (1500×500). The content sits right of
  centre and vertically middle; the avatar covers the bottom left.
- **Avatar** — `assets/out/ph-thumbnail.png` works at 400×400 too.
- **Pinned post** — post 1 of the thread, for launch week.
- **Bio**
  ```
  Checking whether AI agents can actually read your website.
  21 checks, published weights, free diagnosis. botready.dev
  ```

## Rules for the day

- Never ask for upvotes. Ask people to run a scan — the result page is public
  and shareable, and that is the loop.
- Reply to everything within the hour, dismissals included. A well-argued
  disagreement in the thread is worth more than five compliments.
- Someone posts a result showing their own site blocked? Ask before quoting it.
- If a check is shown to be wrong: fix it, say so in the same thread, put it in
  the changelog. That is the campaign.
