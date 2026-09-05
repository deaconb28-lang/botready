# The schedule

Two weeks. Day 0 is the Product Hunt launch. Everything before it exists to make
day 0 work; everything after it exists because day 0 is not a strategy.

## T-14 to T-8: the things that must exist first

| | |
|---|---|
| T-14 | Run the corpus study. Top 1,000 SaaS sites in the index, one scan each, spread over three days so it is indistinguishable from ordinary use. |
| T-12 | Publish the methodology page. Corpus definition, dates, method, raw results, and the caveats. Nothing is pitched before this is live. |
| T-11 | Fill every `[MEASURE]` in this directory from the study. Anything still bracketed gets cut, not guessed. |
| T-10 | Generate every graphic: `node marketing/assets/build.mjs --png`. Check each one at the size it will actually be seen. |
| T-9 | `pnpm video:capture && pnpm video:titles && pnpm video:build`. That builds the launch film, its cutdowns, and reels 1 and 3. **Reel 2 and the 30-second Product Hunt demo still have to be recorded by hand against a live backend** — see `video/README.md`, "The one gap". Real time, no music. |
| T-8 | Build `/press` and the announcement bar. Ship both behind the launch date. |

## T-7 to T-1: the quiet week

| | |
|---|---|
| T-7 | Hunter outreach. Four candidates, individually, one ask each. |
| T-6 | Press pitches, story (1), one outlet at a time. Offer the embargo only if asked. |
| T-5 | Press pitches, story (2), to newsletters and analysts. |
| T-4 | Set up Google Ads: campaigns, negatives, sitelinks, conversion for "scan completed". Leave paused. |
| T-3 | Post X standalone #1 and #2. No launch mention. This is so the account is not cold on the day. |
| T-2 | LinkedIn: post the JavaScript essay (follow-up 2). No launch mention. |
| T-1 | Schedule everything that can be scheduled. Write the Product Hunt first comment and the five replies into a file you can paste from. Sleep. |

## Day 0

Times are Pacific, because that is the clock Product Hunt runs on.

| | |
|---|---|
| 00:01 | Product Hunt listing goes live. First comment posted within 60 seconds. |
| 00:05 | Announcement bar goes live on the site. |
| 05:00 | X launch thread, all nine posts in one sitting. |
| 05:15 | LinkedIn founder post. |
| 05:30 | Instagram carousel 1 and all five story frames. |
| 08:00 ET | Substack essay 1. |
| 08:30 | Reply to every Product Hunt comment. Keep doing this all day, under an hour each. |
| 12:00 | Turn on Google Ads, problem-aware campaign only, half budget. |
| 15:00 | Second X post: something you actually learned from the day's scans, not a bump. |
| 18:00 | LinkedIn comment round on other people's posts about AI search. |
| 22:00 | Stop. Do not post the ranking. |

## T+1 to T+14

| | |
|---|---|
| T+1 | The honest follow-up: what the launch found, including anything that went wrong. Both X and LinkedIn. |
| T+2 | Instagram carousel 2. Google Ads to full budget if cost per scan is defensible. |
| T+3 | LinkedIn follow-up 1 (the mechanism). |
| T+5 | X: reply to and quote the best disagreement of the week. Publicly change something if they were right. |
| T+7 | Reels 1 and 2. |
| T+9 | LinkedIn follow-up 3 (agencies). |
| T+14 | Substack essay 2 — publishing the weights, including the ones we got wrong. Cross-post as a LinkedIn article and a seven-post X thread. |

## The standing rules

- One measurement per week, published, forever. It is the only content strategy
  this product needs and the only one it can defend.
- Never post a scan result of a named site without asking the owner first.
- Reply to every technical objection within a day. A well-argued disagreement in
  public is worth more than a compliment.
- If a check is shown to be wrong, fix it, say so in the same thread, and put it
  in the changelog. That is the campaign.
