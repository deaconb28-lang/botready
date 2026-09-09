/**
 * The posts.
 *
 * Separated from blog.ts so the machinery and the words are not in the same
 * file to scroll past. Everything here is data: see blog.ts for the block
 * types and for what `figures` is doing.
 *
 * Two rules for anything added here.
 *
 * 1. A number in a post is a number we measured, and it carries `figures` with
 *    the date and the corpus. If it came from somewhere else it is attributed
 *    in the sentence. We do not have a conversation-volume corpus and we are
 *    not going to imply one.
 * 2. A post about a thing we sell says what the thing is worth, including when
 *    the honest answer is "less than the people selling it say". The whole
 *    argument for this product is that it only reports what it measured, and
 *    the blog is where that argument is easiest to quietly drop.
 *
 * Ordered newest first. Every date here is the day the words actually went up,
 * because sitemap_lastmod_real fails sites for inventing these and we are not
 * going to fail our own check in the file that explains the check.
 */

import type { BlogPost } from './blog';

const AS_OF = { asOf: '9 September 2026', corpus: '350 scanned sites' };

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'the-google-extended-asymmetry',
    title: "75% of the sites that block an AI crawler let Google's through",
    dek: 'Of 28 sites that served a browser and refused at least one AI client, 21 served Google-Extended anyway. That is a decision about search traffic being applied to four crawlers that do not rank you.',
    category: 'Data',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'We request every site as five clients: Chrome as the control, then ClaudeBot, GPTBot, PerplexityBot and Google-Extended. Same URL, same address, within a second of each other. The only thing that changes between the five requests is the user-agent string, which makes the comparison a comparison.',
      },
      {
        kind: 'p',
        text: 'Across 350 sites, 345 served a browser. Of those, 28 refused at least one AI client. And 21 of those 28 — three quarters — served Google-Extended anyway.',
      },
      {
        kind: 'stats',
        items: [
          { n: '9%', label: 'of sites refused ClaudeBot' },
          { n: '7%', label: 'refused PerplexityBot' },
          { n: '6%', label: 'refused GPTBot' },
          { n: '3%', label: 'refused Google-Extended' },
        ],
      },
      { kind: 'h2', text: 'Why the shape is what it is' },
      {
        kind: 'p',
        text: 'The explanation is not mysterious. Somebody looked at a bot-management rule, recognised one of the names in it, and did not want to find out what happens to their search traffic. Everything with Google in the name got an exception. Nothing else did.',
      },
      {
        kind: 'p',
        text: 'The thing worth noticing is that the exception does not do what it was made to do. Google-Extended is not the crawler that ranks you. It has no effect on Search indexing or on ranking at all — it is the control for Gemini and for grounding in AI features. Googlebot is the one that ranks you, and it is a different token that most bot-management rules already allow.',
      },
      {
        kind: 'note',
        text: 'So the rule as configured protects nothing, and it turns away three of the four assistants that people are actually asking questions in. If the reasoning was "do not risk search", the reasoning was applied to the wrong name.',
      },
      { kind: 'h2', text: 'What a refusal costs' },
      {
        kind: 'p',
        text: 'An assistant that cannot fetch your page does not report an error to the person who asked. It answers anyway, from whatever it has: a directory listing, a review site, a competitor who wrote about you, a cached description from two years ago. You are not absent from the answer. You are described by somebody else in it.',
      },
      {
        kind: 'p',
        text: 'That is the difference between this and a search-engine problem. A page missing from an index is missing. A page missing from a model\'s reach is replaced.',
      },
      { kind: 'h2', text: 'How to check yours in a minute' },
      {
        kind: 'p',
        text: 'You do not need us for this. From a terminal, ask for your own homepage twice with different names on it:',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `curl -s -o /dev/null -w '%{http_code}\\n' https://example.com \\
  -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

curl -s -o /dev/null -w '%{http_code}\\n' https://example.com \\
  -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'`,
      },
      {
        kind: 'p',
        text: 'Two 200s and there is nothing here for you. A 200 and a 403 and you have found the thing. Repeat with `GPTBot/1.2` and `PerplexityBot/1.0` and `Google-Extended`, because they are frequently not treated the same.',
      },
      {
        kind: 'p',
        text: 'If you would rather see all five side by side with the headers and the timing, [run a scan](/scan) — it is free, there is no account, and nothing about the result is blurred.',
      },
      { kind: 'h2', text: 'On the number itself' },
      {
        kind: 'p',
        text: 'Twenty-one of twenty-eight is a small denominator and we would rather say so than round it into a headline. It is 75% of the sites that refused somebody, not 75% of the internet, and the population it describes is sites people asked us to scan — which skews toward sites somebody already suspected had a problem.',
      },
      {
        kind: 'p',
        text: 'The live version of this figure, and the count it is currently taken over, is on [what we have measured](/stats). It moves every time a scan settles.',
      },
    ],
    related: ['a-403-to-claudebot-and-a-200-to-chrome', 'your-waf-is-making-a-decision-nobody-made'],
  },

  {
    slug: 'a-403-to-claudebot-and-a-200-to-chrome',
    title: 'A 403 to ClaudeBot and a 200 to Chrome',
    dek: 'The same URL, from the same address, one second apart, answered two different ways. It is the most common serious finding we have, it is almost never deliberate, and it is usually one line to fix.',
    category: 'Findings',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'Nine per cent of the sites we have scanned answer 200 to a browser and 4xx to ClaudeBot. Not 200 and a thin page. Not 200 and a paywall. A refusal, from an edge that had already decided before anything of yours ran.',
      },
      {
        kind: 'p',
        text: 'Nobody we have shown this to knew about it. That is the consistent part. The person who owns the site did not choose it, the person who set up the CDN did not think of it as a content decision, and the rule that produced it was probably a checkbox with a reasonable-sounding label.',
      },
      { kind: 'h2', text: 'Where it comes from' },
      {
        kind: 'list',
        items: [
          'A managed bot-management ruleset with an "AI scrapers" or "AI bots" category switched to block. This is the most common single cause we see.',
          'A hosting platform that turns on a bot fight mode by default and describes it as protection.',
          'A rate limit written per user-agent that treats anything non-browser as abuse, at a threshold one page fetch exceeds.',
          'A robots.txt `Disallow: /` under a specific agent name, added years ago for a scraper with a similar name.',
          'A country or ASN block that happens to cover the data centre the crawler runs from.',
        ],
      },
      {
        kind: 'p',
        text: 'The first three are the ones that surprise people, because they were never typed. They arrived with a default, or with a vendor\'s ruleset update, and the site owner\'s only involvement was accepting a configuration recommendation eighteen months ago.',
      },
      { kind: 'h2', text: 'What it looks like from the other side' },
      {
        kind: 'p',
        text: 'Somebody asks an assistant which firm in their city does the thing you do. The assistant has your competitor\'s page, a directory entry about you from 2023, and a 403 where your site should be. It writes an answer. Your name may well appear in it — described by the directory entry.',
      },
      {
        kind: 'note',
        text: 'There is no error state for this. The person asking never learns that a source was unreachable, and you never learn that you were the source.',
      },
      { kind: 'h2', text: 'Telling a block from a bad page' },
      {
        kind: 'p',
        text: 'The distinction matters because the fixes are unrelated. We classify what came back rather than counting anything over 399 as the same event:',
      },
      {
        kind: 'list',
        items: [
          '**403 or 401** — an edge rule refused. Fix the rule.',
          '**429** — a rate limit fired. Usually a threshold, not a policy, and usually one request was enough to trip it.',
          '**503 with a challenge page** — an interstitial. The page technically returned, and what it contains is a captcha rather than your content, which for a reading client is the same as a refusal.',
          '**200 with the wrong page** — a soft 404, where the site says fine and hands back an error page. Rare in our corpus: one site in 350. Worth naming because it is invisible to anything that only checks status codes.',
          '**5xx** — your origin, not a policy. A different problem and not this one.',
        ],
      },
      { kind: 'h2', text: 'The fix, most of the time' },
      {
        kind: 'p',
        text: 'Allow the named agents explicitly, above whatever generic rule is catching them. On Cloudflare that is a WAF custom rule with a skip action, ordered before the managed bot ruleset. The equivalent exists on every other edge; the mechanism differs and the shape does not.',
      },
      {
        kind: 'p',
        text: 'Then check that robots.txt is not separately telling them to go away, because those are two different systems and fixing one does not touch the other. [Your WAF is making a decision nobody made](/blog/your-waf-is-making-a-decision-nobody-made) goes through it properly.',
      },
      {
        kind: 'p',
        text: 'And when you allow a crawler in, allow the real one: a user-agent string is free to type, and [verifying which fetches were genuinely the agent they claimed](/blog/a-user-agent-string-is-a-claim) is a separate job that most analytics gets wrong.',
      },
      { kind: 'h2', text: 'What we will not do to find it' },
      {
        kind: 'p',
        text: 'If a site refuses our crawler, we record it as refused and show it as refused. We do not retry with a browser user-agent, we do not use residential proxies, and we do not solve challenges. A block is the finding — working around one would mean the number we report is a number about our evasion rather than about your site. [Our crawler page](/bot) states the whole limit, including how to block us.',
      },
    ],
    related: ['the-google-extended-asymmetry', 'your-waf-is-making-a-decision-nobody-made', 'javascript-is-not-your-problem'],
  },

  {
    slug: 'javascript-is-not-your-problem',
    title: 'JavaScript is probably not your problem',
    dek: 'Six per cent of the sites we scanned fail on client-side rendering. Nine per cent are refused at the door before rendering is even a question. The advice everyone gives is aimed at the smaller number.',
    category: 'Findings',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'Every piece of writing about making a site legible to AI opens with the same advice: your content is behind JavaScript, crawlers do not run JavaScript, server-render it. It is real advice and it is not wrong. It is just aimed at a problem that, in our corpus, is a third the size of the one nobody mentions.',
      },
      {
        kind: 'stats',
        items: [
          { n: '6%', label: 'of sites fail the JavaScript dependency check' },
          { n: '9%', label: 'are refused outright by an edge rule' },
          { n: '77%', label: 'serve no markdown or plain-text alternative' },
          { n: '90%', label: 'have no agent manifest' },
        ],
      },
      { kind: 'h2', text: 'What we actually measure' },
      {
        kind: 'p',
        text: 'We fetch the page twice: once as raw HTML with no execution, once through a headless browser that runs everything. Then we compare how much readable text exists in each. A site where the raw HTML carries almost none of the words is one where a client that does not execute scripts gets an empty document.',
      },
      {
        kind: 'p',
        text: 'That check fails on 6% of sites, and warns on rather more. The framework era did most of this work already: Next, Nuxt, Astro, SvelteKit and Remix all server-render by default, and a large share of the web that people assume is a client-side app ships its text in the first response.',
      },
      { kind: 'h2', text: 'What the ranking actually is' },
      {
        kind: 'p',
        text: 'Ordered by how often sites fail it, the list looks nothing like the advice:',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'No agent manifest — 90%. Mostly fine, and we changed our scoring because of it. [Why is a post of its own.](/blog/nine-in-ten-sites-have-no-agent-manifest)',
          'No markdown or plain-text alternative — 77%.',
          'No reachable API or developer documentation — 61%.',
          'No llms.txt — 42%. [Worth less than the people selling it say.](/blog/does-llms-txt-do-anything)',
          'Cache headers that make conditional requests impossible — 38%.',
          'A sitemap whose lastmod is the build date — 37%.',
          'Missing semantic landmarks — 25%.',
          'Duplicate titles or descriptions across pages — 24%.',
          'No structured data at all — 20%.',
          'An edge that refuses at least one AI client — 9%.',
          'Content that only exists after JavaScript runs — 6%.',
        ],
      },
      {
        kind: 'note',
        text: 'A refusal outranks a rendering problem in severity as well as in frequency. A client-side-rendered page is hard to read. A 403 is impossible to read, and no amount of server rendering behind it makes any difference.',
      },
      { kind: 'h2', text: 'Why the advice is shaped the way it is' },
      {
        kind: 'p',
        text: 'Rendering is the problem that transferred cleanly from SEO. It was the crawler problem for a decade, everyone who writes about crawlers already knew the argument, and it needed no new evidence to repeat. The edge-refusal problem is newer, it is invisible from inside your own browser, and finding it requires deliberately asking your own site a question with a different name on the request.',
      },
      {
        kind: 'p',
        text: 'Which is most of why we built this. Not because rendering does not matter, but because the check nobody runs is the one that finds the worst thing.',
      },
      { kind: 'h2', text: 'The order to work in' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Confirm nothing is refused. Five status codes, one minute, no tooling required.',
          'Confirm the words are in the first response. If they are, rendering is done and you can stop reading advice about it.',
          'Then the legibility work: structured data, a stable description, a plain-text alternative, honest cache headers.',
        ],
      },
      {
        kind: 'p',
        text: 'One and two are usually an afternoon between them. Three is ongoing. Nearly everything published on this subject starts at three. [The full check list and every weight is published](/what-we-check), so you can disagree with the order.',
      },
    ],
    related: ['a-403-to-claudebot-and-a-200-to-chrome', 'nine-in-ten-sites-have-no-agent-manifest'],
  },

  {
    slug: 'nine-in-ten-sites-have-no-agent-manifest',
    title: 'Nine in ten sites have no agent manifest, and most of them should not',
    dek: 'A check that 90% of sites fail is not a finding, it is a wall. Here is why we rebuilt a whole scoring category around that, and what we changed it to.',
    category: 'Method',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'Ninety per cent of the sites we scan have no `/.well-known/agent.json`. For a while we took points off all of them. That was a mistake, and correcting it changed how we think about what a check is for.',
      },
      { kind: 'h2', text: 'What went wrong' },
      {
        kind: 'p',
        text: 'Our actionability category was four checks: an agent manifest, reachable API documentation, form semantics, and whether documentation sat behind a wall. Sensible enough if you are a software company. We ran a 44-site sweep of local businesses — dentists, plumbers, a bakery, two law firms — and 38 of the 44 scored exactly zero on the category.',
      },
      {
        kind: 'p',
        text: 'Zero, on 15 points out of 100, for every one of them. And there was nothing any of them could do about it. A dentist does not have an API. Publishing an agent manifest describing the API they do not have would be worse than not having one.',
      },
      {
        kind: 'note',
        text: 'A category where nearly every site in a sector scores zero is not measuring that sector. It is a constant being subtracted from their total, and constants carry no information.',
      },
      { kind: 'h2', text: 'The two wrong fixes' },
      {
        kind: 'p',
        text: 'The obvious move is to exempt local businesses from the API checks. We already have that machinery — a sector profile names the checks a sector is not measured on, and an exemption is a skip, which leaves the denominator rather than counting as a zero. But applied here it would have been a fudge, for a reason worth stating:',
      },
      {
        kind: 'p',
        text: 'We only ever select a profile from what a site declares about itself, in JSON-LD, using schema.org\'s own vocabulary. Never from the absence of the thing being exempted. "No API docs, therefore exempt from API docs" makes the score a tautology — every site passes everything it does not have. A site that declares nothing recognised is measured on everything, because silence is not a claim.',
      },
      {
        kind: 'p',
        text: 'The second wrong fix is to reweight the category down to near nothing. That fails differently: it says the question does not matter, when for a plumber the question "can an agent find out how to contact you and book you" matters more than almost anything else we check.',
      },
      { kind: 'h2', text: 'What we did instead' },
      {
        kind: 'p',
        text: 'We kept the category and its weight, and changed what is inside it. Scoring version 1.4 added three checks that any business can pass and most can fix in an afternoon:',
      },
      {
        kind: 'list',
        items: [
          '**Contact reachable** — is there a phone number, an email address or a postal address a machine can extract? A `tel:` link, a `mailto:`, or `telephone` in JSON-LD all count.',
          '**Action declared** — does the site say, in structured form, what you can do here? A `potentialAction`, a `ReserveAction`, an `OrderAction`. Booking a table is an action. So is requesting a quote.',
          '**Action not JavaScript-only** — if the primary way to act is a booking widget that only exists after a script runs, a client that does not execute scripts sees a page with no way to do anything.',
        ],
      },
      {
        kind: 'p',
        text: 'The category went from 15 catalog points to 26, and the weight stayed at 15, because points inside a category are normalised against the category weight. Every one of the 44 businesses now has something in that category they can pass, and something concrete to do about the ones they fail.',
      },
      { kind: 'h2', text: 'The agent manifest check is still there' },
      {
        kind: 'p',
        text: 'It is worth fewer points and it is still worth having, because for a site with an API it is a real answer to a real question. The 90% failure rate is not evidence that the check is wrong. It is evidence that a check most sites fail should not be most of a category.',
      },
      { kind: 'h2', text: 'Why any of this is public' },
      {
        kind: 'p',
        text: 'Changing a weight changes every score, so it is a versioned event rather than a tweak. Every score row records the version that produced it, 1.2 and 1.3 are archived and still scorable, and [the current catalog and every weight is published](/what-we-check). You cannot argue with a score you cannot see the arithmetic of, and a score nobody can argue with is a number we made up.',
      },
    ],
    related: ['what-a-median-score-tells-you', 'javascript-is-not-your-problem'],
  },

  {
    slug: 'does-llms-txt-do-anything',
    title: 'Does llms.txt do anything?',
    dek: 'We generate llms.txt files and charge for them, so read this with that in mind. The honest answer is that no major assistant is documented as fetching it, and it is still worth twenty minutes.',
    category: 'Standards',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'Forty-two per cent of the sites we scan have no llms.txt. We check for it, we generate one in the fix pack, and we charge money for that fix pack. So here is the conflict of interest up front, and then the actual answer.',
      },
      { kind: 'h2', text: 'What it is' },
      {
        kind: 'p',
        text: 'A markdown file at `/llms.txt`: what this site is, and a list of its most useful pages with a sentence about each. Optionally `/llms-full.txt`, which inlines the whole text of those pages so a client needs one request instead of seven. The proposal came from Jeremy Howard in 2024. It is a convention, not a standard — there is no working group and no specification with a version number.',
      },
      { kind: 'h2', text: 'The honest state of adoption' },
      {
        kind: 'p',
        text: 'No major assistant publicly documents fetching llms.txt as part of answering a question. Not OpenAI, not Anthropic, not Perplexity, not Google. People will tell you otherwise. Ask them for the documentation.',
      },
      {
        kind: 'note',
        text: 'If somebody shows you a graph of traffic attributed to llms.txt, ask how a fetch of that file was distinguished from a fetch of anything else, and what the denominator was.',
      },
      {
        kind: 'p',
        text: 'What is true is that a growing number of tools do read it: documentation platforms, coding agents pointed at a library, a range of smaller crawlers, and anything a developer builds against a site deliberately. That is a real audience. It is just a different and smaller one than the pitch usually implies.',
      },
      { kind: 'h2', text: 'Why we still say write one' },
      {
        kind: 'p',
        text: 'Three reasons, none of them "assistants read it".',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'It costs twenty minutes and it cannot hurt. The downside case for a small static file is that nothing fetches it.',
          'Writing it is the useful part. Naming your ten most important pages and saying in one sentence what each is for is an exercise most sites have never done, and it surfaces the pages nobody can describe.',
          'It is cheap insurance on a convention that might get adopted. If it does, you already have one. If it does not, you spent twenty minutes.',
        ],
      },
      { kind: 'h2', text: 'The thing that actually works today' },
      {
        kind: 'p',
        text: 'Serving the same page as markdown when a client asks for it. Seventy-seven per cent of sites have no plain-text or markdown alternative at all, which is a much bigger gap than the llms.txt one and it has a mechanism that already exists: content negotiation, which every HTTP client understands.',
      },
      {
        kind: 'code',
        lang: 'http',
        text: `GET /pricing HTTP/1.1
Accept: text/markdown

HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Link: </pricing.md>; rel="alternate"; type="text/markdown"`,
      },
      {
        kind: 'p',
        text: 'A client that wants your words should not have to run a browser and then strip tags to get them. This site does it on every public page, including the one you are reading — add `.md` to the URL, or send the header. Our [API and docs page](/docs) lists everything machine-readable we serve.',
      },
      { kind: 'h2', text: 'What a good one looks like' },
      {
        kind: 'p',
        text: 'Short. A title, one line saying what the site is, then links with a sentence each. Not a sitemap — a sitemap is every URL, and this is the ten that matter. Not marketing copy. The test is whether somebody who has never heard of you could answer a question about you from it.',
      },
      {
        kind: 'p',
        text: 'If you want ours as a shape to copy it is at `/llms.txt`, generated from the same page list that builds the sitemap so the two cannot disagree. And if you want one built from your own site, from the URLs a scan confirmed actually return 200, that is what the [fix pack](/pricing) is.',
      },
    ],
    related: ['javascript-is-not-your-problem', 'your-sitemap-lastmod-is-probably-lying'],
  },

  {
    slug: 'your-waf-is-making-a-decision-nobody-made',
    title: 'Your WAF is making a content decision nobody made',
    dek: 'A managed bot ruleset, a default left on at signup, a threshold set for scrapers. How to find the rule that is refusing reading agents, and how to let them through without letting scrapers through.',
    category: 'How-to',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'When a site refuses ClaudeBot, the person who owns the site almost never knows. The refusal came from a managed ruleset, or from a default that was on when they signed up, and nothing about it looked like a decision about who may read the site.',
      },
      {
        kind: 'p',
        text: 'This is how to find it and how to change it. The mechanisms differ by vendor; the shape does not.',
      },
      { kind: 'h2', text: 'First, confirm it is the edge' },
      {
        kind: 'p',
        text: 'Ask for the same URL twice with different names and look at the headers, not just the code:',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `curl -sI https://example.com -A 'Mozilla/5.0 ... Chrome/125.0 Safari/537.36'
curl -sI https://example.com -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'`,
      },
      {
        kind: 'list',
        items: [
          'A `cf-ray` or `server: cloudflare` on the refusal, with none of your application headers, means Cloudflare answered and your origin never saw it.',
          'A `x-amzn-` header or an `x-cache: Error from cloudfront` means AWS.',
          'Your own framework headers on the 403 means your application refused, and the rule is in your code or your reverse proxy config.',
          'A 503 with an HTML body containing a challenge means an interstitial. For a reading client that is a refusal with extra steps.',
        ],
      },
      { kind: 'h2', text: 'Cloudflare' },
      {
        kind: 'p',
        text: 'Two separate things can be doing it, and turning off one does not touch the other.',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          '**Bot fight mode** (Security → Bots). A single switch, on by default on some plans. It is blunt by design and it does not read your allow rules.',
          '**A managed bot ruleset or an AI-scraper block.** Cloudflare added a one-click block for AI crawlers and a great many sites turned it on without noticing which names were in the category.',
          '**A WAF custom rule** somebody wrote, often years ago, matching a user-agent substring.',
        ],
      },
      {
        kind: 'p',
        text: 'To let the reading agents through, add a custom rule with a **skip** action and order it above the managed ruleset. Matching on user-agent alone is fine as a first move and is not proof of anything — see below.',
      },
      {
        kind: 'code',
        lang: 'text',
        text: `(http.user_agent contains "ClaudeBot") or
(http.user_agent contains "GPTBot") or
(http.user_agent contains "PerplexityBot") or
(http.user_agent contains "Google-Extended")
  → Skip: All remaining custom rules, Managed rules, Bot fight mode`,
      },
      { kind: 'h2', text: 'AWS and everyone else' },
      {
        kind: 'list',
        items: [
          '**AWS WAF** — the `AWSManagedRulesBotControlRuleSet` categorises crawlers. Add a scope-down statement or an explicit allow rule at a lower priority number, since AWS evaluates ascending.',
          '**Fastly and Akamai** — bot-management products with a category for AI crawlers. Same move: an allow list evaluated before the category rule.',
          '**Vercel and Netlify** — usually not the cause, but check any firewall or bot-protection feature you enabled.',
          '**nginx or Apache in front of your app** — grep your configs for `user_agent`. A `map` block from 2019 blocking scrapers is a common find.',
        ],
      },
      { kind: 'h2', text: 'Then check robots.txt separately' },
      {
        kind: 'p',
        text: 'These are unrelated systems. Your edge can allow a crawler that your robots.txt asks not to come, and a well-behaved crawler will obey the robots.txt and never arrive. Read your own file and look for agent-specific blocks:',
      },
      {
        kind: 'code',
        lang: 'text',
        text: `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /`,
      },
      {
        kind: 'p',
        text: 'If you want them to read the site, remove those. If you do not, leave them — but then remove the edge rule too, so the decision is stated in one place instead of enforced twice by accident.',
      },
      { kind: 'h2', text: 'The thing to be careful about' },
      {
        kind: 'p',
        text: 'A user-agent string is typed, not proved. An allow rule matching on the string alone will also let through anything that copies it, which is a real amount of traffic. That is an acceptable trade for getting unblocked today, and the durable version is to verify identity by reverse DNS or published IP range. [A user-agent string is a claim](/blog/a-user-agent-string-is-a-claim) covers how, and why nearly every crawler dashboard reports claims as visits.',
      },
      { kind: 'h2', text: 'Then confirm you actually fixed it' },
      {
        kind: 'p',
        text: 'Rules cache and rulesets have ordering surprises. Re-run the two curl commands. Or [run a scan](/scan) and look at all five clients at once — same URL, same second, and the status codes side by side.',
      },
    ],
    related: ['a-403-to-claudebot-and-a-200-to-chrome', 'a-user-agent-string-is-a-claim', 'the-google-extended-asymmetry'],
  },

  {
    slug: 'a-user-agent-string-is-a-claim',
    title: 'A user-agent string is a claim, not an identity',
    dek: 'Every crawler dashboard in this category counts user-agent strings and calls the total AI traffic. Anyone can type ClaudeBot into a header. Here is how the identity is actually established.',
    category: 'How-to',
    published: '2026-09-09',
    updated: '2026-09-09',
    body: [
      {
        kind: 'p',
        text: 'Open your access logs, grep for `GPTBot`, count the lines. That number is being sold to you as a measure of how much AI traffic your site gets. It is a count of requests that typed a string.',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `curl -s https://example.com -A 'GPTBot/1.2' -o /dev/null`,
      },
      {
        kind: 'p',
        text: 'That line just added one to somebody\'s AI traffic. It took no permission, no infrastructure and no cleverness.',
      },
      { kind: 'h2', text: 'Who is actually in your logs claiming to be a crawler' },
      {
        kind: 'list',
        items: [
          'The real crawler.',
          'Scrapers using a well-known name because a lot of sites allow it, which is exactly the effect the allow rule creates.',
          'SEO and monitoring tools checking how your site responds to crawlers — a fetch that mimics the agent on purpose.',
          'Us, if you scanned your own site, which is why our crawler uses its own name and never anybody else\'s.',
          'Ordinary automation with a copied header, because copying a working header is the normal way people write scripts.',
        ],
      },
      { kind: 'h2', text: 'How identity is actually established' },
      {
        kind: 'p',
        text: 'Two mechanisms, and neither of them involves trusting the string.',
      },
      {
        kind: 'p',
        text: '**Forward-confirmed reverse DNS.** Take the connecting IP, look up its PTR record, check the hostname is under the vendor\'s domain, then resolve that hostname forward and confirm it comes back to the same IP. Both directions matter: reverse DNS alone is asserted by whoever controls the address block.',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `dig +short -x 203.0.113.10
# crawl-203-0-113-10.example-vendor.com.

dig +short crawl-203-0-113-10.example-vendor.com
# 203.0.113.10   ← same address, so the claim holds`,
      },
      {
        kind: 'p',
        text: '**A published address range.** Several vendors publish the IP ranges their crawlers fetch from as a JSON file. Check membership, refresh on a schedule, and remember that a stale copy fails honest traffic — which is worse than the problem it solves.',
      },
      { kind: 'h2', text: 'Three numbers, not one' },
      {
        kind: 'p',
        text: 'Once identity is checked rather than assumed, a fetch falls into one of three states, and collapsing them into one total throws away the interesting part:',
      },
      {
        kind: 'list',
        items: [
          '**Verified** — the claim was proved by rDNS or a published range. This is your actual crawler traffic.',
          '**Unproven** — no proof either way. Common and not sinister: a vendor with no published ranges and no PTR records leaves every fetch here.',
          '**Proven false** — claimed a name and came from an address that provably is not it. This is the number worth alerting on, and no dashboard that counts strings can produce it.',
        ],
      },
      {
        kind: 'note',
        text: 'We record how each fetch\'s identity was established alongside the fetch, and a claim with no proof is never counted as the agent it claimed to be. It is the difference between "GPTBot fetched you 400 times" and "400 requests said GPTBot, 310 of them were".',
      },
      { kind: 'h2', text: 'What this does to your logs' },
      {
        kind: 'p',
        text: 'Verification is a DNS lookup per unique address, cached — cheap enough to do on ingest rather than in a batch. The part that needs deciding up front is what you keep.',
      },
      {
        kind: 'p',
        text: 'The moment you accept somebody else\'s traffic logs you are processing their visitors\' data. Human IP addresses should be dropped or hashed in memory before anything is written down, not cleaned up on a schedule afterwards. A crawler IP needs to live only as long as the verification takes, and the verdict is the thing worth storing. We built ours that way and we would tell you to build yours that way whether or not you ever use ours.',
      },
      { kind: 'h2', text: 'If you only do one thing' },
      {
        kind: 'p',
        text: 'Do not accept a crawler-traffic number from any tool that cannot tell you how it established identity. Ask the question. The answer is usually that it grepped the user-agent.',
      },
    ],
    related: ['your-waf-is-making-a-decision-nobody-made', 'six-pages-one-second-apart'],
  },

  {
    slug: 'your-sitemap-lastmod-is-probably-lying',
    title: 'Your sitemap lastmod is probably lying',
    dek: 'Thirty-seven per cent of sites stamp every URL with the deploy timestamp. It tells a crawler nothing except when you last shipped, and it was true of this site until we checked.',
    category: 'How-to',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'Thirty-seven per cent of the sites we scan have a sitemap where `lastmod` is not the date the page changed. Usually every URL carries the same timestamp, and that timestamp is the build.',
      },
      {
        kind: 'p',
        text: 'This site did it too. We found it by running our own check against ourselves, which is a good argument for running checks against yourself.',
      },
      { kind: 'h2', text: 'Why it happens' },
      {
        kind: 'p',
        text: 'Almost every static-site generator and framework offers a sitemap helper, and the easy implementation is `new Date()` at build time. It is correct in the sense that the file was generated then. It is useless in the sense that a crawler is asking a different question.',
      },
      {
        kind: 'code',
        lang: 'ts',
        text: `// The version nearly everyone ships
export default function sitemap() {
  return PAGES.map((page) => ({
    url: page.url,
    lastModified: new Date(),   // ← the deploy, not the page
  }));
}`,
      },
      { kind: 'h2', text: 'Why it costs you' },
      {
        kind: 'p',
        text: 'A crawler with a budget uses `lastmod` to decide what to re-fetch. If everything changed today, nothing is prioritised, and the signal is discarded — a sitemap where every date is identical is treated as a sitemap with no dates, which is what you have.',
      },
      {
        kind: 'p',
        text: 'For a reading agent it is worse than neutral. It is a small, checkable claim about your site that turns out not to hold, on a file whose only purpose is to be trusted.',
      },
      {
        kind: 'note',
        text: 'The 41 sites we skipped this check on had no sitemap at all. They are counted separately, because a site with no sitemap has not made a false claim about one.',
      },
      { kind: 'h2', text: 'What to do instead' },
      {
        kind: 'p',
        text: 'Get the date from something that actually knows when the content changed.',
      },
      {
        kind: 'list',
        items: [
          '**A CMS** — you already have an updated-at column. Use it.',
          '**Markdown or MDX in the repo** — `git log -1 --format=%cI -- path/to/file` gives the last commit that touched it. Note the file\'s mtime is the checkout time in CI and is not this.',
          '**Hand-maintained pages** — keep the date beside the page in one place and let the sitemap read it. Ours is a list in `lib/content.ts` with the date and the files that are the evidence for it.',
          '**Genuinely unknown** — leave `lastmod` out. An absent field is honest. A wrong one is a claim.',
        ],
      },
      { kind: 'h2', text: 'The same mistake in three other places' },
      {
        kind: 'p',
        text: 'Once you have a real date, the same one should appear everywhere the page is dated, and usually does not:',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'The `Last-Modified` header. Most frameworks send none for a server-rendered page, so every revisit is a full download of a page that has not changed since August. A conditional request is impossible without it.',
          '`dateModified` in your Article or WebPage JSON-LD, which is frequently a third different date.',
          'The visible "updated" line on the page, which is often the only honest one of the four.',
        ],
      },
      {
        kind: 'p',
        text: 'Four dates for one page is three opportunities to disagree. One source, read by all four, is the fix. That is how this site does it, and [the check and its weight are published](/what-we-check) like everything else.',
      },
    ],
    related: ['does-llms-txt-do-anything', 'javascript-is-not-your-problem'],
  },

  {
    slug: 'what-a-median-score-tells-you',
    title: 'What a median score by sector tells you, and what a global ranking does not',
    dek: 'The median local business scores 59. The median SaaS company scores 74. A single leaderboard across both mostly measures which kind of business a site is.',
    category: 'Method',
    published: '2026-09-09',
    updated: '2026-09-09',
    figures: AS_OF,
    body: [
      {
        kind: 'p',
        text: 'In a sweep of 44 sites, the median score for a north-Seattle local business was 59.5. For SaaS companies it was 74. For a mixed sample of everything, 54.',
      },
      {
        kind: 'p',
        text: 'That spread is wide enough that a single global ranking is largely a sector classifier with extra steps. Telling a bakery it ranks below Zapier is arithmetic, not information.',
      },
      { kind: 'h2', text: 'Why the spread exists' },
      {
        kind: 'p',
        text: 'Not because software companies try harder. Because the checks that separate a 74 from a 59 are things a software company gets for free: a framework that server-renders, developer documentation that exists anyway, structured data a marketing site template shipped with, an engineer who noticed the cache headers.',
      },
      {
        kind: 'p',
        text: 'A dentist has none of that and does not need most of it. Their site can be completely legible to a reading agent and still score in the fifties against a catalog weighted for a category they are not in.',
      },
      { kind: 'h2', text: 'What we compare against instead' },
      {
        kind: 'p',
        text: 'The cohort is the scoring profile — the same thing that decided which checks the site was measured on. Two sites in the same profile have the same denominator, so their totals are on the same scale and a median across them means something. A median across mixed profiles averages numbers built from different check sets, which reads like a comparison and is not one.',
      },
      {
        kind: 'note',
        text: 'A profile is only ever selected from what a site declares about itself in JSON-LD, using schema.org\'s vocabulary. Never inferred from the absence of the thing being exempted, and never from `Product`, `Offer` or `WebPage` — a SaaS company declares all three, and matching on them filed every site with a price on it as a shop.',
      },
      { kind: 'h2', text: 'When we say nothing at all' },
      {
        kind: 'p',
        text: 'A median is only as good as what it was taken over, so the comparison refuses to appear in three cases:',
      },
      {
        kind: 'list',
        items: [
          'Fewer than twelve scored sites in the cohort. A median of three is an anecdote with a decimal point, and it is exactly the kind of number somebody would act on.',
          'A cohort of one, which is the site looking at itself. It would print "exactly the median", which reads as a compliment and is arithmetic over a single row.',
          'A scoring version with nothing scored under it yet — the normal state for a day or two after a version ships, because a median has to be computed within a version or it compares totals built from different catalogs.',
        ],
      },
      {
        kind: 'p',
        text: 'And when it does appear, the count is in the sentence rather than in a footnote: "13 points above the median for a local business, taken from 44 scored sites." You are entitled to weigh it without hunting for the denominator.',
      },
      { kind: 'h2', text: 'The general lesson' },
      {
        kind: 'p',
        text: 'Any single number describing a website is an average over a choice of what to measure, and the choice does more work than the arithmetic. That is true of ours. It is why every weight we use is published, why every score records the version that produced it, and why the current medians and counts are live on [what we have measured](/stats) rather than quoted from the sweep that found them.',
      },
    ],
    related: ['nine-in-ten-sites-have-no-agent-manifest', 'six-pages-one-second-apart'],
  },

  {
    slug: 'six-pages-one-second-apart',
    title: 'Six pages, one second apart, and the things we refuse to do',
    dek: 'What our crawler requests, what it never does, and why a scanner that could get past a block would produce a worse number than one that cannot.',
    category: 'Method',
    published: '2026-09-09',
    updated: '2026-09-09',
    // A different denominator from the other posts: a refusal rate is over
    // every scan that settled, including the ones that never reached a score.
    figures: { asOf: '9 September 2026', corpus: '405 settled scans' },
    body: [
      {
        kind: 'p',
        text: 'We measure whether sites are legible to reading agents, which means we are a crawler, which means we are the thing we would be complaining about if we did it badly. So here is exactly what ours does.',
      },
      { kind: 'h2', text: 'What a scan requests' },
      {
        kind: 'list',
        ordered: true,
        items: [
          '`GET /robots.txt`, first, always. If it disallows us, the scan ends there and we say so on the result.',
          'The target page, once as each client in the catalog, sequentially, from the same address.',
          '`/sitemap.xml`, `/llms.txt`, `/llms-full.txt` and four `.well-known` manifests.',
          'Up to five further pages linked from the target, one second apart.',
        ],
      },
      {
        kind: 'p',
        text: 'Six pages maximum, sequential, a second between them. That is a diagnostic tool, not a load generator, and it is a cap rather than a target — most scans fetch fewer.',
      },
      { kind: 'h2', text: 'What it never does' },
      {
        kind: 'list',
        items: [
          'Spoof a browser user-agent to get past a block.',
          'Use a residential proxy or rotate addresses.',
          'Solve or bypass a captcha or a JavaScript challenge.',
          'Submit a form, sign in, or send anything that changes state.',
        ],
      },
      {
        kind: 'p',
        text: 'The first one is the load-bearing one, and it is worth being precise about why. If a site refuses `BotreadyBot/1.0` and we retried as Chrome and got in, we could produce a richer report. We would also have destroyed the only thing the report is worth: the finding is that this site refuses reading agents, and a scanner that works around refusals cannot observe refusals. Our own robots.txt compliance is checked in CI, because a promise nobody tests is a sentence on a page.',
      },
      {
        kind: 'note',
        text: 'A block is the finding, not an obstacle. We record it as blocked and display it as blocked — 7% of settled scans end that way, and those scans never reach a score.',
      },
      { kind: 'h2', text: 'Why the five requests go out the way they do' },
      {
        kind: 'p',
        text: 'Same URL, same address, within a second, with only the user-agent differing. Every one of those constraints exists to remove an explanation.',
      },
      {
        kind: 'list',
        items: [
          '**Same URL** — otherwise you are comparing two pages.',
          '**Same address** — otherwise a difference could be a geographic or ASN rule rather than an agent rule.',
          '**Within a second** — otherwise it could be a deploy, an outage or a rate limit that reset in between.',
          '**Only the name changes** — so when the answers differ, the name is why.',
        ],
      },
      {
        kind: 'p',
        text: 'It is a controlled comparison rather than a crawl, which is the whole reason the [status-code differential](/blog/a-403-to-claudebot-and-a-200-to-chrome) is worth anything.',
      },
      { kind: 'h2', text: 'How to block us' },
      {
        kind: 'code',
        lang: 'text',
        text: `User-agent: BotreadyBot
Disallow: /`,
      },
      {
        kind: 'p',
        text: 'We read that on every scan and stop. Our full crawler statement, including the user-agent string in its exact form and where to write to us about it, is on [our crawler page](/bot).',
      },
      { kind: 'h2', text: 'What we do with what we find' },
      {
        kind: 'p',
        text: 'A scanner emits observations: status codes, byte counts, header values, character counts. Never a judgement — nothing we store says `blocked: true`. Every number a person reads is computed afterwards by a published, versioned function over those observations, which is what lets us re-score history when the method changes instead of quietly reinterpreting old numbers.',
      },
      {
        kind: 'p',
        text: 'And the diagnosis is free, in full, always. Nothing about a result is blurred or held back for payment. [What we sell](/pricing) is the generated fix files, which is a different thing from the finding.',
      },
    ],
    related: ['a-403-to-claudebot-and-a-200-to-chrome', 'a-user-agent-string-is-a-claim', 'what-a-median-score-tells-you'],
  },
];
