# The launch film — locked script

74.7 seconds. `script.mjs` is the machine-readable version and the one the build
reads; this file is for reading.

Every line is either quoted from the product (`apps/web/lib/copy.ts`,
`packages/core/checks.json`) or from a cleared slot in `../taglines.md`. None of
it is newly written marketing language.

| In | On screen | Voiceover |
|---|---|---|
| 0:00 | `AgentRace`, five rows landing one per 620ms | One request. Sent five times, one second apart, from one address. |
| 0:07 | The same shot, entered at its resting point so all five codes are up | Chrome got two hundred. Claude got four-oh-three. |
| 0:13 | Title card: a lime `200`, a coral `403` | Same URL. Same second. Nobody decided that. |
| 0:20 | Title card | You will not find this in your analytics. A request that was refused never became a session. |
| 0:27 | `/scan/live` — the ring, the five stages, the terminal log | So we ask. Five clients, one second apart, then one headless render. |
| 0:35 | The report header: the score counting to 50, grade D, six category bars | *(silent)* |
| 0:38 | "What each client got": one 200 and four 403s | Same URL, same second. Four of the five clients got nothing readable. |
| 0:45 | Title card | Every weight is published, so you can argue with the score instead of believing it. |
| 0:53 | The coral 403 refusal screen | And if your site refuses us, the page says so. We never work around a block. |
| 1:00 | The violet fix-pack panel and `$ claude "apply botready-fixes.md"` | The diagnosis is free. The fix files are fifteen dollars, written from your own scan. |
| 1:10 | Title card: the URL box, caret blinking | Are you BotReady? botready dot dev. |

## Why the film says two different numbers

At 0:07 it says Claude got a 403 over the landing page's own example, which shows
three of five refused. At 0:38 it says four of five, over the `waf-blocked-spa`
fixture, which shows four.

Both are true, each is said over the frame that shows it, and they are never
averaged into a single claim about the world. The rule the script holds itself
to: **a number said out loud is a number visible in the same frame.** That is
also why the beat at 0:07 enters its shot at 3.0s — continuing from 0:00 would
have put the line over a row still reading `···`.

## What the film does not say

- That anyone is losing traffic. We measure legibility, not revenue.
- That a score causes citation. We have not got that evidence and will not imply
  it.
- Any of the language retired in `../taglines.md`.

## The silent beat

0:35 carries no narration. The score counting up and the six bars filling are the
beat. The read was 87 seconds with a line over it, against a 60–75 second brief,
and holding a beat is a better answer than speeding a voice up.
