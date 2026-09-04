# The site itself

The website is the best asset in the campaign because it is the only one where
the reader can act. Everything here is a change to botready.dev, scoped so it
can be built and reverted without touching the product.

## Launch week

### 1 — The announcement bar

One line above the header, for launch week only, then removed. Not a modal, not
a slide-in, not dismissible-with-a-cookie — a bar that is there and then is not.

```
We're live on Product Hunt today. →
```

Design: ink background, lime text, 2px bottom border, mono at 12.5px, the arrow
is the link. It must not push the URL box below the fold on a phone; if it does,
it does not ship.

### 2 — The hero is already right

Do not touch it for the launch. "Are you BotReady?" with a URL box is the
correct first screen and a launch banner over the top of it would be the
campaign getting in the way of the product.

### 3 — `/press`

A real page, not a folder link. Boilerplate, the fact sheet, logo downloads,
screenshots at 2400px, and — the part that makes it worth building — the corpus
methodology and the raw results. Register it in `lib/content.ts` like every
other public page so it gets a markdown representation, an entry in llms.txt and
an honest `lastmod`. A press page that our own scanner cannot read would be
embarrassing.

### 4 — The public index is the campaign

`/index/saas` and its three siblings already exist and are rebuilt nightly. They
are the best organic asset here: a page per segment, ranked, with a public
result page behind every row. Point the press at them and let them find their
own examples.

One change worth making for launch: sort by "biggest change this week" as well
as by score, so there is a reason to come back.

## Evergreen, and worth more than launch week

### 5 — `/vs/` — nothing

We are not building comparison pages. They are the standard growth play in this
category and they are the one that would cost us the argument: you cannot say
"a score you cannot argue with is a horoscope" on Monday and publish a page
scoring a competitor on Tuesday.

### 6 — The result page is the referral loop

It is already public and already carries an OG card with the grade and the
headline finding. The three things that would make it spread further, in order
of value:

1. A copy-link button next to the score with a toast that says "Link copied" —
   the same verb, per the voice rules.
2. The share card should name the finding, not just the grade. `botready.dev/r/
   example.com — 403 to ClaudeBot, 200 to Chrome` is a headline; `Grade C` is
   not.
3. An "email me this result" field for people who scanned on a phone and will
   act on a laptop. One field, no account.

### 7 — `/for/agencies`

The only landing-page variant worth building, because it is a real audience with
a real different job. Same product, three changes: the hero says a free scan is
a first meeting, the fix pack is framed as a deliverable rather than a purchase,
and the pricing section leads with monitoring across three domains. Register it
in `lib/content.ts`.

### 8 — Keep the score honest in public

The single most persuasive thing on this site is that our own first scan scored
57 and we published it. Keep a short entry on `/what-we-check` — or a
`/changelog` — recording what our score is now and what changed. It is the
proof that the number is not decoration.

## What not to do

- No exit-intent modal.
- No newsletter popup. The Substack link belongs in the footer.
- No "as seen in" logo strip until there is something to put in it.
- No live counter of scans run. It is a vanity number and it invites the
  question of what happens when it stops moving.
- No countdown timers, no fake scarcity, no "12 people are scanning right now".
