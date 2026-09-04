# X

The channel where the product is most likely to be argued with, which is the
best thing that can happen to it. Post the evidence, not the adjectives.

## The launch thread

Nine posts. Post 1 carries `assets/x-card.svg`. Posts 3 and 6 carry
screenshots of a real result page. Thread it in one sitting — a thread posted
over an hour reads as a thread posted over an hour.

**1/**
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

**3/**
```
And you cannot see it.

A request that gets refused never becomes a session, so it is not in your
analytics. It is not in Search Console either — Googlebot went through fine.

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
It also asks the questions an agent asks before it reads your HTML:

· is a robots.txt rule blocking readers but not Googlebot
· is there an llms.txt
· is your pricing readable without running JS
· is your JSON-LD actually in the response, or only after hydration
```

**6/**
```
21 checks, six categories, one score out of 100.

Every weight is published at botready.dev/what-we-check with the reasoning
under it, because a score nobody can argue with is a horoscope.

If you think a weight is wrong, tell me and I have to answer in public.
```

**7/**
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
Run it on your own site. Thirty seconds, no signup:

botready.dev

If it comes back green, good — close the tab. If a check fires on a site you
know is configured correctly, that is my bug, and I want to hear about it.
```

## Standalone posts

One a day for a month. Each stands alone; none needs the thread.

### The finding

1. `curl -A "ClaudeBot" https://yoursite.com`
   If that returns anything other than what your browser gets, you have a
   problem your analytics cannot show you.

2. The scariest line in a scan result is not a low score. It is two rows next to
   each other: `chrome 200` and `claudebot 403`, timestamps one second apart.

3. Nobody has ever sat in a meeting and decided to block ChatGPT from reading
   their pricing page. It happens to sites every week anyway.

4. "We do not block AI crawlers." Neither did any of the sites I have found
   blocking AI crawlers. A preset is not a decision, but the 403 is identical.

5. Your WAF has an opinion about AI. You did not give it one.

6. Search Console will never show you this. Googlebot got through. It is the
   other four that did not.

### The JavaScript half

7. If your pricing page renders its prices in React and nothing else, a client
   that does not run JavaScript sees a page about a company with no prices.

8. There is a number in every scan I like more than the score: raw characters
   versus rendered characters. When the first is 8% of the second, the page is
   an application and only pretends to be a document.

9. Server-render the words. That is the whole trick. The rest of the checks are
   worth 75 points between them and this one habit moves most of the other 25.

### The convention half

10. `llms.txt` is a markdown file at your root that tells a client which of your
    pages matter. It is fifteen minutes of work. Most sites that have one wrote
    it in an afternoon and never touched it again.

11. A bad llms.txt is worse than none. If half the links 404, a client that
    trusted it spent its budget on your dead ends and learns not to trust the
    convention.

12. Serve your pages as markdown when a client sends `Accept: text/markdown`.
    We do. Ours is at botready.dev/pricing.md and it is generated from the same
    data the HTML renders, so the two cannot disagree.

### The argument

13. We published every weight in the scoring catalog, with the reasoning under
    each one, before anybody asked. Not because it is generous — because a
    score you cannot argue with is a horoscope.

14. Two of our published numbers disagreed for months: the catalog said a check
    was worth 18 points, the findings list said 13. Both read the same file.
    Both were right. We fixed it and wrote up why. SCORING-PLAN.md, in the repo.

15. Our own site scored 57 and a C the first time we scanned it. That is on the
    record. We fixed the seven failing checks the same day, and you can read
    exactly what we changed.

16. A threshold that turns 0.699 into one grade and 0.701 into another is not a
    measurement, it is a cliff. We know. It is written down as the next thing to
    fix, with the numbers.

### The refusal

17. We will not spoof a user agent to get past your WAF. Every competitor that
    does gets a nicer-looking number about a site that agents genuinely cannot
    read.

18. Two lines in your robots.txt and we stop, permanently, on every future scan:
    `User-agent: BotreadyBot` / `Disallow: /`. There is no form and no list to
    be removed from.

19. Max six pages, sequential, one second apart. We are a diagnostic tool, not a
    load generator, and a scan should be indistinguishable from one curious
    person reading your site.

### The offer

20. The diagnosis is free and complete. Every finding, all the evidence, no
    account, nothing blurred. The $15 is for the files, if you would rather not
    write them.

21. What $15 buys: an llms.txt built only from URLs the scan confirmed return
    200, a robots.txt patch, a WAF rule that separates readers from scrapers,
    the JSON-LD you are missing, and a prompt for whichever coding agent you
    use.

22. Monitoring is $5/month and does one thing: emails you the day a client that
    could read you stops being able to. That regression is silent by nature —
    it is a WAF update, not a deploy.

## Replies

Bank them. Speed matters more than polish.

**"This is just SEO with extra steps."**
```
Related, but a different failure. SEO is about ranking among pages that were
fetched successfully. This is about the fetch — Googlebot gets through and
ClaudeBot does not, so you can be perfectly optimised and still absent. Almost
nobody's WAF refuses Googlebot, which is why there is no SEO equivalent of the
headline check.
```

**"AI search is a fad."**
```
Might be. The check costs thirty seconds and nothing, and half of what it finds
(server-rendered text, real structured data, a sitemap with honest dates) is
worth having whether or not you are right.
```

**"You are fearmongering to sell a $15 file."**
```
Fair challenge. The diagnosis is free and unblurred — you can read every finding
and fix all of it yourself without paying. And I will not claim a high score
gets you cited, because nobody has that evidence. What I claim is narrower: a
refused client cannot read you, and a client that does not run JS cannot see
text that only exists after hydration. Both are checkable in your own terminal.
```

**"My robots.txt blocks AI on purpose."**
```
Then you have decided, and we record it as a decision rather than a failure. The
check is really looking for the site that blocks reading agents while leaving
Googlebot alone — that pattern is almost never deliberate.
```

**"Scanned my site, got [number], the [x] check is wrong."**
```
Send me the scan URL. A check that fires on a correctly configured site is my
bug and I would rather fix it than argue about it.
```
