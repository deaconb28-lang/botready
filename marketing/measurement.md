# What we count

A campaign for a product whose argument is "measure it, do not guess" should not
be run on impressions.

## The funnel that matters

```
someone hears about it
  → runs a scan                       ← the only top-line number
    → reads the whole result
      → shares the result URL         ← the loop
      → buys the fix pack             ← the business
        → comes back and scans again  ← the product worked
```

## The four numbers

| Number | Where from | Why this one |
|---|---|---|
| **Scans started by a new address** | `scans` table, distinct identity per day | The only honest measure of reach. A visit is not an event; a scan is. |
| **Result pages shared** | copy-link clicks plus referrers to `/scan/` and `/r/` | The loop. If this is near zero the product is not interesting enough to show someone, and no amount of ad spend fixes that. |
| **Fix packs bought per 100 scans** | Stripe, over scans in the same window | The business, expressed as a rate rather than a total, so it cannot be flattered by a traffic spike. |
| **Scans of a domain that was scanned before** | `scans` grouped by domain | Somebody fixed something and came back. The strongest signal in the whole system, and the slowest. |

## Per channel

Every link carries a `?ref=` we can read in the logs. Not UTM soup — one
parameter, one value, so the report is a `group by`.

`ref=ph` `ref=x` `ref=li` `ref=substack` `ref=ig` `ref=press` `ref=ads`

Google Ads gets one conversion action and it is **scan completed**, not "landed
on the page". Optimising to a landing is how you buy traffic that never runs
anything.

## What we will not count

- **Impressions and reach.** They are available on every channel and they
  predict nothing here.
- **Followers.** A follower who never runs a scan has told us nothing.
- **Upvotes.** Position on a launch day is not a business outcome, and treating
  it as one is what produces the upvote-begging that makes the whole ritual
  worthless.
- **"AI visibility" of botready.dev itself.** We will run our own scan and
  publish the score, because that is checkable. We will not claim a number for
  how often assistants recommend us, because we would be making up the same
  metric we criticise.

## The weekly review

Four numbers, one line each, in a text file, appended to. If a channel has not
produced a scan in two weeks, stop doing it and write down why rather than
posting into it out of habit.
