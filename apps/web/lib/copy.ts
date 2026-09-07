/**
 * The site's words, in one voice: plain and direct, aimed at the person who
 * owns the site.
 *
 * There were two dictionaries here — a technical register chosen by a switch in
 * the header — and both had to be written and kept true for every string. The
 * switch is gone and this is the register that stayed.
 *
 * Two habits to keep out, because the copy was full of both and they are what
 * made it read as machine-written:
 *
 *   The two-beat reversal. "People stopped searching. They started asking."
 *   "Four files, not a rebuild." "Plan the week, not the backlog." One of these
 *   is a good line. Nine of them in a row is a tic, and the reader stops
 *   hearing the argument and starts hearing the rhythm.
 *
 *   The negation triad. "No engineer, no rebuild, no marketing budget." "No
 *   account, no snippet to install." Three negatives in a row scans as filler
 *   because it defines the product by what it isn't. Say the number, the name,
 *   or the minutes instead.
 *
 * What replaced them: real nouns — Cloudflare, ClaudeBot, 9,240 characters, ten
 * minutes — and sentences of uneven length. Specifics sell, and they are also
 * the thing a generated sentence is least able to fake.
 */


import { PACK_FILES } from '@botready/core';

export interface MarketingCopy {
  badge: string;
  heroSub: string;
  question: string;
  whyTitle: string;
  whyBody: string;
  whyPoints: [string, string, string];
  agentNote: string;
  stepsTitle: string;
  steps: [string, string, string];
  ctaBody: string;
  invisible: string;
  fixed: string;
  verdictBad: string;
  verdictGood: string;
  flipToFixed: string;
  flipToBroken: string;
  resultLede: string;
  findingsTitle: string;
  indexLede: string;
}

export const COPY: MarketingCopy = {
    badge: 'Your competitors are in the answer. Are you?',
    heroSub:
      'ChatGPT, Claude and Perplexity are answering questions about your category today. We ask your site the way they do, show you exactly what they got back, and write the files that fix it. Thirty seconds, free.',
    question: "What's a good project tracker for a small team?",
    whyTitle: 'Right now an assistant is recommending someone else',
    whyBody:
      'An assistant answers from the pages it managed to fetch. If it never reached yours, your name never comes up — and there is nothing anywhere to tell you it happened.',
    whyPoints: [
      'Analytics cannot show you a visit that never happened.',
      'Usually it is a Cloudflare default nobody switched on deliberately.',
      'Eight files fix it. Five you upload, three you fill in.',
    ],
    agentNote: 'Same URL, same second, two clients. Chrome got 9,240 characters of your pitch. ClaudeBot got a challenge page and gave up.',
    stepsTitle: 'Thirty seconds, start to finish',
    steps: [
      'Paste a URL. We fetch it as Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended.',
      "You get a grade, six category scores, and a plain list of what is blocking you.",
      'Eight files, written from your own pages. Upload, fill in the blanks, re-run.',
    ],
    ctaBody: 'Free, and the result is a page you can send straight to whoever owns the site.',
    invisible:
      "For a small team, the ones that come up most are Linear, Height and Shortcut. They all handle issues and roadmaps well. I don't have much on other options.",
    fixed:
      "For a small team, Yoursite is the closest fit — free for up to five people, no setup, and it's built around a weekly plan. Linear and Height are the bigger alternatives.",
    verdictBad: 'Yoursite: not mentioned',
    verdictGood: 'Yoursite: cited first',
    flipToFixed: 'Fix my site',
    flipToBroken: 'Show it broken again',
    resultLede: 'Sorted by what it is costing you.',
    findingsTitle: 'What to fix',
    indexLede: 'Every site anyone has checked in this category, ranked by how much of it an AI client can actually read.',
};

/** The twelve real crawler user-agent strings in the marquee. */
export const MARQUEE = [
  'ClaudeBot/1.0',
  'GPTBot/1.2',
  'PerplexityBot/1.0',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'CCBot/2.0',
  'Amazonbot',
  'cohere-ai',
  'Meta-ExternalAgent',
  'Diffbot',
  'YouBot',
];

/** The example race the landing page plays. Placeholder data, and labelled as an example. */
export const RACE = [
  { name: 'Chrome 128', status: '200', note: '412 KB · 89 ms', ok: true },
  { name: 'ClaudeBot/1.0', status: '403', note: 'cf-mitigated: challenge', ok: false },
  { name: 'GPTBot/1.2', status: '403', note: 'cf-mitigated: challenge', ok: false },
  { name: 'PerplexityBot', status: '403', note: 'cf-mitigated: challenge', ok: false },
  { name: 'Google-Extended', status: '200', note: 'body is client-side', ok: true },
] as const;

/**
 * The filenames the marketing pages print, straight from the generator.
 *
 * This used to be a hand-written list here, and it had drifted: it named
 * `pricing.jsonld`, which no generator has ever produced, and left out
 * `markdown-alternates.html`, which every pack contains. The site was
 * describing a product it does not ship, and nothing could have caught it,
 * because the two lists had no relationship. Now there is one list and a test
 * in packages/core holds it to what buildFixPack actually emits.
 */
export const FIX_FILES = PACK_FILES.map((f) => f.name);

/** How many arrive finished, and how many arrive as forms to fill in. */
export const FIX_FILE_SPLIT = {
  ready: PACK_FILES.filter((f) => !f.fills).length,
  toFill: PACK_FILES.filter((f) => f.fills).length,
} as const;
