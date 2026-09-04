# Tech press

The story is not "startup launches AI SEO tool". Nobody will write that. There
are two stories a journalist can actually run:

1. **A large share of the web is refusing the assistants their customers use,
   by accident.** That is a measurable claim about the internet, and we are the
   ones who can measure it.
2. **The AI visibility category is unfalsifiable, and one tool is publishing its
   weights and refusing to spoof user agents.** That is a story about a category
   rather than a product, and it puts us in it.

Lead with (1) for reporters, (2) for newsletter writers and analysts.

## The number

Story (1) needs a number and we do not have one yet. Before pitching, run the
index over a defined corpus — the top 1,000 SaaS sites in the public index —
and be able to say precisely:

- `[MEASURE]`% returned a different status class to at least one reading agent
  than to the Chrome control
- `[MEASURE]`% blocked at least one reading agent in robots.txt while allowing
  Googlebot
- `[MEASURE]`% had a raw-to-rendered character ratio above 0.7

Publish the methodology, the date, the corpus definition and the raw results
alongside the claim, on a page anyone can check. **Do not pitch until this
exists.** A press story built on an unpublished number is the exact failure this
company is arguing against, and the first reporter who asks for the data ends
the relationship.

## Boilerplate

```
BotReady measures how legible a website is to AI agents. Give it a URL and it
requests that page as five different clients — Chrome as a control, then
ClaudeBot, GPTBot, PerplexityBot and Google-Extended — one second apart from a
single address, and compares what each one got back. It runs 21 checks across
six categories with every weight published, and generates the files that close
the gaps it finds. The diagnosis is free and complete. BotReady never spoofs a
user agent, uses a proxy, or works around a block: a refusal is recorded and
published as a refusal. botready.dev
```

## Fact sheet

| | |
|---|---|
| What it is | A free diagnostic that measures whether AI agents can fetch and read a website |
| How it works | Five sequential requests as five clients from one IP, plus one headless render, plus the well-known files, compared against a published catalog |
| Checks | 21, across retrievability, discovery, representation, structure, actionability, freshness |
| Weights | Published in full at botready.dev/what-we-check, with the reasoning under each |
| Scoring | A pure function of the recorded evidence. Every score records its version, so history is re-scored rather than rewritten |
| Price | Diagnosis free and never blurred. Fix pack $15 one time. Monitoring $5/month. |
| Constraints | Max 6 pages per scan, sequential, 1 second apart. robots.txt obeyed, including on its own site. No user-agent spoofing, no proxies, no captcha solving. |
| Public API | Yes, no key: `POST /api/scan`, `GET /api/scan/{id}`. Described at botready.dev/openapi.json |
| Founder | Deacon Brantley |
| Launched | `[DATE]` |
| Press contact | team@botready.dev |

## Press kit contents

At `botready.dev/press` or a shared folder, whichever ships first:

- Boilerplate, short (40 words) and long (100 words)
- The fact sheet above
- Logo: SVG, PNG at 512 and 2048, on lavender and on white
- Product screenshots at 2400px: result page, live scan, the weights catalog,
  the fix pack, the crawler page
- `assets/press-hero.png`
- The methodology page for the corpus study
- Founder headshot and 50-word bio `[NEEDED]`
- A line saying what we will not say: no claim that a high score causes citation

## Pitch email — the measurement story

Send to reporters covering search, the open web, or infrastructure. One outlet
at a time, no BCC, no attachments, subject line under nine words.

```
Subject: A lot of sites are blocking AI assistants by accident

Hi [name],

I scanned the top 1,000 SaaS sites for one thing: whether they return the same
HTTP status to a browser and to the reading agents behind ChatGPT, Claude and
Perplexity. Same URL, one second apart, same IP.

[MEASURE]% did not. And of those, [MEASURE]% were still letting Googlebot
through — which is the tell that nobody decided this. It comes from bot
protection presets and from robots.txt blocklists that circulated in 2023 and
were never revisited.

The reason it persists is that it is invisible. A refused request never becomes
a session, so it is not in any analytics product; Search Console is green
because Googlebot is fine. You have to make the request yourself to find it.

The corpus, the method and the raw results are here: [URL]. Everything is
reproducible with three curl commands and I am happy to walk you through it, or
to run the scan live on any site you want to name.

I run botready.dev, which does this check, so I am obviously not disinterested.
The data holds up without the product and I would rather you checked it than
took my word.

— Deacon Brantley
team@botready.dev
```

## Pitch email — the category story

For newsletters and analysts.

```
Subject: The AEO category has a falsifiability problem

Hi [name],

Every tool in the "AI visibility" category outputs a score, and I have not found
one that publishes how the score is computed. That is not a small omission: a
number nobody can argue with is not a measurement.

I built botready.dev partly to have an argument about it. The whole catalog is
public — 21 checks, six categories, every weight, with a paragraph under each
saying why it is worth what it is worth. We shipped a contradiction in our own
published numbers and wrote up what was wrong rather than quietly fixing it. We
scanned our own site and got 57 out of 100, which is also published.

The other half is a constraint: the scanner never spoofs a user agent or uses a
proxy to get past a WAF. That costs us — a competitor that does gets a nicer
number about a site the actual clients cannot read — and it is the only reason
the number means anything.

If you are writing about this category, I would be a useful and unusually
specific source, including about what our own score does not prove. The scoring
roadmap, with the defects we have not fixed yet, is public in the repo.

— Deacon Brantley
```

## Outlets, in order

Work down. One at a time for the exclusive-ish outlets; the rest can go in
parallel once the story is out.

1. Newsletters with a technical readership and a fast turnaround — the ones that
   will actually run the curl commands.
2. Search-industry trade press — this is squarely their beat and they cover
   crawler behaviour closely.
3. Developer-infrastructure publications — the WAF angle is their story more
   than the AI angle is.
4. General tech press — only with the corpus number in hand. Without it there is
   no story for them.

## Embargo

Do not offer one unless a reporter asks. If they do: the corpus data goes to
them under embargo until launch morning, the product is public and unembargoed,
and we do not offer the same data to a second outlet during the window. Say all
three of those in the email rather than in a follow-up.

## Do not

- Send a press release. Send a finding.
- Say "revolutionary", "game-changing", or "the future of search".
- Pitch a launch. Launches are not news; a measurement is.
- Cite a number from a third-party report we have not read in full.
