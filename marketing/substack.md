# Substack

The long-form channel, and the one that has to earn the others. Three essays,
one every two weeks. The first is written in full below; the other two are
outlined to the point where they can be drafted in a sitting.

Publication name: **The Refused Request**
Subtitle: *What the web looks like to the clients that answer questions about it.*

House rules: every claim in an essay is either checkable by the reader in their
own terminal or carries a link to the evidence. No essay ends in a sales
paragraph — the product is named where it is the answer and nowhere else. Every
post ends with the same two lines and no CTA graphic.

---

## Essay 1 — "The 403 nobody sent"

*Publish on launch day, 08:00 ET.*

> There is a request your website is refusing that you never decided to refuse.
> It is not in your logs in a way you would notice, it is not in your analytics
> at all, and the only way to find it is to make it yourself.

Last spring I was looking at a client's site for an unrelated reason and ran a
habit I have — `curl` with a few different user agents, just to see. Chrome:
200, a full page, 84 kilobytes. One second later, same machine, same IP,
identifying as ClaudeBot: 403.

I assumed I had made a mistake. I had not. I have since run that comparison on a
few hundred sites and it comes back split more often than anyone expects, and
almost never on purpose.

### Why nobody decided it

I have found three causes, and none of them is a decision.

**The preset.** Every major CDN ships bot protection, most of it is on by
default for a new site, and it classifies by reputation and behaviour rather
than intent. A declared, well-behaved reading agent making a single request from
an unfamiliar range looks a great deal like a scraper making its first request.
The preset is not wrong to be suspicious. It is wrong to be unable to tell the
difference, and nobody has told it to try.

**The pasted blocklist.** In 2023 a lot of robots.txt blocklists went around,
naming GPTBot, ClaudeBot, CCBot, anthropic-ai and a dozen others. They got
pasted into a lot of files. The person who pasted them frequently no longer
works there. The block is still there, and — this is the part that matters — it
almost always leaves Googlebot alone, because the lists were written in the
specific panic about training data and not about answering.

**The 2am rule.** Somebody scraped you, an engineer wrote a rule at two in the
morning, and it has been in the config ever since doing rather more than it was
written to do.

Three causes, one status code, no meeting.

### Why you cannot see it

This is the part that turns an annoyance into a structural problem.

A request that is refused never becomes a session. It does not appear in
Google Analytics, Plausible, Fathom or anything else that runs in a browser,
because nothing ran in a browser. It appears in your edge logs as one line among
several million, indistinguishable at a glance from the actual scrapers you
wanted to stop.

Search Console will not tell you either, and this is the cruel part: Googlebot
is almost never the agent being refused. Your search health is green. Your rank
is fine. The channel that is failing is the one you have no console for.

So the failure is invisible by construction. You will not find it by looking
harder at the tools you have. You have to make the request.

### Making the request

You can do this now, in your own terminal, and I would rather you did it that
way than took my word for anything:

```
curl -sI -A "Mozilla/5.0 (compatible)" https://yoursite.com | head -1
curl -sI -A "ClaudeBot/1.0" https://yoursite.com | head -1
curl -sI -A "GPTBot/1.0" https://yoursite.com | head -1
```

Three lines. If they do not all say `200`, you have found it.

There are two complications that matter and one that does not. The ones that
matter: some edges answer differently on a second request from the same address,
so leave a second between them; and some return `200` with a challenge page in
the body, which is a refusal wearing a success code, so check the byte count as
well as the status. The one that does not: yes, a user agent is trivially
spoofable, and no, that does not make this test meaningless. The real clients
send the real string. The question is what your edge does when it sees it.

### The second half of the problem

Suppose everything returns 200. You are still only halfway, because these
clients fetch your HTML and read what is in it. They do not run your JavaScript.

So the question becomes: how much of your page exists in the response, and how
much only appears after a browser executes a few hundred kilobytes of it? There
is a clean way to measure that — the readable characters in the raw response,
divided by the readable characters after rendering. Under about 0.4 and you are
fine. Above 0.7 and the page is, to a non-browser client, an application that
has not started yet.

You can do this one by hand too. View source — the actual view-source, not the
inspector, which lies to you by showing the page after JavaScript has run — and
search for your headline price, or your best sentence. If it is not there, it is
not there for them.

### What I would do about it, in order

1. **Find out.** Three curl commands, or thirty seconds on a tool.
2. **Separate readers from scrapers at the edge.** They are distinguishable —
   declared user agent, published IP ranges, request rate. If you want to refuse
   both, refuse both; just do it on purpose.
3. **Server-render the words.** Not the whole application. The paragraphs, the
   prices, the headings. This is usually a build setting rather than a rewrite.
4. **Then, and only then,** think about llms.txt, structured data, markdown
   alternates and the rest of it. They are real and they help, and they help
   nothing at all on a page nobody was allowed to fetch.

The order is the argument. Almost all the writing about this starts at step
four, which is a bit like tuning a signal nobody is receiving.

### The tool

I built the thing I wanted while doing this by hand. It requests your page as
five clients a second apart from one address, compares the answers, and runs
twenty more checks around them. The diagnosis is free and complete, the weights
are published so you can tell me they are wrong, and it never works around a
block — if your site refuses it, the result says so, because a number I cheated
to get would be worth nothing.

It is at botready.dev. But the curl commands above are free too, and they will
tell you the most important thing this essay has to say.

---

*Written by Deacon Brantley. botready.dev checks whether AI agents can read your
site. The diagnosis is free; the weights are published at
botready.dev/what-we-check.*

---

## Essay 2 — "Publishing the weights, including the ones we got wrong"

*Two weeks after launch.*

The argument: a score is a set of opinions with arithmetic on top, and the only
thing that separates a useful score from a horoscope is whether the opinions are
written down where you can disagree with them.

Beats:

- Open on the contradiction we shipped: `/what-we-check` said a check was worth
  18 points, the result page said 13, both read the same JSON, both were right.
  Explain the two meanings of "points" and why fifteen of twenty-one checks
  agreed by coincidence.
- Why we found it late: the four categories whose points already sum to their
  weight hid it.
- The fix, and the road not taken — rescaling the catalog would have needed
  90/7 in a JSON file, and rounding would have moved every score, which is the
  one thing the fix promised not to do.
- The cliff we have not fixed yet, with the real table: 0.699 scores 54, 0.701
  scores 50, 0.99 also scores 50. Why a threshold may set a word and must not
  create a step in a number, and why this is worse for monitoring than for a
  one-off scan.
- Retrievability is a slice when it should be a gate: a site that refuses all
  four agents still earns its structured-data points, measured with *our*
  fetcher. The number overstates, and it overstates in exactly the case the
  product exists for.
- Calibration: we have started recording which domains an assistant actually
  cites, per prompt per week. When there is enough of it we publish the
  analysis, confounders named — brand size dominates, the sample is drawn from
  paying customers, and correlation is not the check causing anything. And if it
  says a weight is wrong, that gets published too.
- Close: we scanned our own site and got 57. Link the write-up.

Link `SCORING-PLAN.md` and `/what-we-check` throughout. This essay is the moat,
written down.

## Essay 3 — "We do not spoof user agents, and it costs us"

*Four weeks after launch.*

The argument: the constraint is the product.

Beats:

- What it would take to get past a WAF: a browser user agent, a residential
  proxy, a captcha solver. All commercially available, all cheap.
- What you get if you do it: a nicer-looking number about a site that the actual
  clients genuinely cannot read. The tool reports success on a failure.
- The customer-facing cost to us: sites we cannot score, results that say
  "this site refuses our scanner" where a competitor shows a grade.
- The other constraints and what each one costs: six pages sequential a second
  apart (slower scans, less evidence), obeying our own robots.txt (some sites
  we simply cannot measure), never blurring the diagnosis (a worse funnel).
- The general point: in a category where the deliverable is a number, every
  shortcut is a lie told with arithmetic, and the only defensible position is
  the one you publish and can be held to.
- Close on the /bot page: the user agent, the block instructions, the four things
  we will never do, and an email that reaches someone who can change the crawler.

## Cross-posting

Each essay is also a LinkedIn article (same text, no changes) and an X thread of
seven posts pulling the strongest beats. Never post the thread and the essay in
the same hour — thread first, essay six hours later, so the thread's replies feed
the essay.
