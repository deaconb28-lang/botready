# LinkedIn

Different room from X. The reader here is a head of growth, a marketing
director, or an agency owner, and they are looking for something they can bring
to a meeting on Monday. Same facts, more of the "so what", and no `curl`.

Rules for this channel: no "🚀", no one-word-per-line poetry, no "I'll say the
quiet part out loud". Paragraphs. The first two lines are all that shows before
"see more", so the hook has to be complete in them.

## Founder launch post

```
Last spring I ran a check on a client's website that I have run a hundred times
since. It takes about thirty seconds.

I requested their homepage as Chrome. I got a 200 and a full page. I requested
the same URL, one second later, from the same computer, identifying as
ClaudeBot. I got a 403.

Nobody at that company had decided to block AI assistants. It was a bot
protection preset that had been switched on a year earlier, and it could not
tell the difference between a scraper and a client trying to answer a customer's
question about them.

What made it worth building a company around is the second part: they could not
have found this on their own. A request that gets refused never becomes a
session, so it is not in analytics. Search Console showed nothing, because
Googlebot was getting through fine. The only way to see it is to make the
request yourself, as each client, and put the answers side by side.

So that is what BotReady does. You give it a URL. It requests the page as
Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended, one second apart
from one address, and shows you what each one got back. Then it runs 21 more
checks — whether a robots.txt rule is blocking readers while letting search
crawlers through, whether your pricing is readable without running JavaScript,
whether your structured data is in the response or only appears after the page
hydrates.

Three decisions I want to be held to:

The diagnosis is free and never blurred. Every finding, all the evidence, no
account. You can act on all of it and never pay us.

Every weight is published, with the reasoning under it. A score nobody can argue
with is a horoscope. Ours is at botready.dev/what-we-check and if you think a
number is wrong I have to answer you in public.

The scanner never works around a block. No spoofed user agents, no residential
proxies, no captcha solving. If your site refuses our crawler, the result page
says your site refuses our crawler. A number you cheated to get is worth
nothing, and the whole product is one number.

It is live now and free to run: botready.dev

If it comes back green, close the tab and get on with your day. If a check fires
on a site you know is configured correctly, that is my bug and I would like to
hear about it.
```

## Company page — About

```
BotReady measures how legible a website is to AI agents.

Give it a URL and it requests that page as five different clients — Chrome as a
control, then ClaudeBot, GPTBot, PerplexityBot and Google-Extended — one second
apart from one address, and compares what each one got back. The finding it
exists for is a site that returns 200 to a browser and 403 to a reading agent in
the same second, which is common and almost never deliberate.

21 checks across six categories, with every weight published. The diagnosis is
free and complete. The generated fix files are $15.
```

**Tagline** (120 characters): `See what AI agents see when they read your site. 21 checks, published weights, free diagnosis.`

## Four follow-ups

Post one every three days after launch. Each teaches something a reader could
use even if they never run a scan — that is what earns the fifth post the right
to sell.

### 1 — the mechanism, for people who do not believe it

```
The most common objection I get to BotReady is that this cannot be as widespread
as I am saying, because nobody would deliberately block the assistants their
customers are asking about them.

Which is exactly right, and exactly the point. Nobody decides this. Here are the
three ways it happens.

A bot protection preset. Every major CDN ships one, most of them are on by
default on new sites, and they classify by reputation and behaviour rather than
by intent. A declared, well-behaved reading agent making one request looks a lot
like a scraper making its first request.

A pasted robots.txt. Around 2023 a lot of blocklists circulated that named
GPTBot, ClaudeBot, CCBot and a dozen others. They were pasted into a lot of
robots.txt files, usually by someone who left the company since, and they are
still there.

A rule added after an incident. Somebody scraped you, an engineer added a rule
at 2am, and the rule is still there two years later doing more than it was meant
to.

None of these is a decision. All three produce an identical 403.

The check is thirty seconds and free: botready.dev
```

### 2 — the JavaScript half, for the marketing audience

```
A thing worth knowing if you have a marketing site built in the last five years.

Most of the clients that answer questions about your company do not run
JavaScript. They fetch your HTML and read what is in it.

So if your prices are rendered by React and nothing is in the initial response,
what those clients see is a page about a company that does not appear to have
prices. Not a wrong price. No price.

You can check this yourself without any tool. In your browser, view source —
actual view-source, not the inspector, which shows you the page after JavaScript
has run. Search for your headline price. If it is not there, it is not there for
them either.

The fix is usually one build setting rather than a rewrite. Most frameworks will
server-render a marketing page if you ask them to; often the page was
client-rendered because nobody chose either way.

BotReady measures the gap as a ratio — characters in the raw response against
characters after rendering — and it is one of the two things I would look at
first on any site: botready.dev
```

### 3 — for agencies

```
If you run an agency, here is a free first meeting.

Run botready.dev on a prospect's site before you talk to them. It takes thirty
seconds, needs no access to anything of theirs, and the result page is a public
URL you can send.

About a third of the time you will find something they did not know: their
firewall refusing the assistants their customers ask about them, or a pricing
page that is invisible to anything that does not run JavaScript.

That is a better opening than a capabilities deck, because it is about them and
it is checkable. And when they ask what it would cost to fix, the answer is a
scope you can write in an afternoon.

The diagnosis is free and I have no interest in gating it. The $15 fix pack
exists for people who would rather not write the files themselves — if that is
your billable afternoon, take it.
```

### 4 — the argument for publishing the weights

```
We published the entire scoring catalog before anyone asked for it. 21 checks,
six categories, every weight, with a paragraph under each one saying why it is
worth what it is worth.

I want to explain why, because it cost us something.

Any score is a set of opinions with arithmetic on top. That is fine, right up
until you will not say what the opinions are — at which point people are correct
to treat the number as a horoscope. So the weights are on a public page, and if
you think retrievability should not be 25% of the total, you can say so with the
document in front of you and we have to answer.

It has already cost us. Two of our own published numbers disagreed for months:
the catalog said a check was worth 18 points, the findings list said 13. Both
read the same file, and both were right — one was a share within a category, the
other was the effect on the final 100. A careful reader would have found that
before we did. We fixed it, wrote up what was wrong, and left the wrong numbers
in the document as the record.

We also scanned our own site and got 57 out of 100. That is published too.

The alternative is a black box, and the whole industry this sits next to is
full of them. botready.dev/what-we-check
```

## Comment starters

For other people's posts about AI search, AEO, or LLM traffic. Never link in the
first comment; be useful and let the profile do the work.

- "The part I would add: before optimising for these clients, it is worth
  checking they can reach you at all. A surprising share of sites return a 403
  to ClaudeBot and a 200 to Chrome, from the same address, and no analytics
  product will show you it happened."
- "Worth separating two things that get merged: whether a client can *fetch*
  your page, and whether it can *understand* it. Almost all the advice is about
  the second. The first fails silently and is much cheaper to fix."
- "The measurable version of this is a ratio: characters in the raw HTTP
  response against characters after the page renders. Under about 0.4 you are
  fine. Over 0.7 the page is effectively empty to anything that does not run a
  browser."
