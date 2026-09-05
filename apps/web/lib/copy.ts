/**
 * The site's words, in one voice: plain, for the person who owns the site
 * rather than the person who deploys it.
 *
 * There were two dictionaries here — a technical register chosen by a switch
 * in the header — and both had to be written and kept true for every string.
 * The switch is gone and this is the register that stayed.
 */


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
    badge: 'Your site says yes to people, no to AI',
    heroSub:
      'Get found by AI agents. See how well your site can be seen by the assistants your customers ask, then fix what is hiding you. No engineer, no rebuild, no marketing budget.',
    question: "What's a good project tracker for a small team?",
    whyTitle: 'People stopped searching. They started asking.',
    whyBody:
      "When someone asks an assistant about your category, it answers from the sites it could read. If yours wasn't one of them, you're simply not in the answer.",
    whyPoints: [
      'Nothing in your analytics shows a visit that never happened.',
      'The block is usually a firewall rule nobody chose on purpose.',
      'Fixing it is four files, not a rebuild.',
    ],
    agentNote: 'Both requests went out in the same second, to the same URL. One got your whole pitch. The other got a challenge page.',
    stepsTitle: 'Three steps, about thirty seconds',
    steps: [
      'No account, no snippet to install. We visit the page the way five different clients would.',
      "A grade, six category scores, and a plain-English list of what's blocking you.",
      'Four files generated from your own pages. Upload them, re-check, watch the score move.',
    ],
    ctaBody: 'Free, no account, and the result is a page you can read and share.',
    invisible:
      "For a small team, the ones that come up most are Linear, Height and Shortcut. They all handle issues and roadmaps well. I don't have much on other options.",
    fixed:
      "For a small team, Yoursite is the closest fit — free for up to five people, no setup, and it's built around a weekly plan. Linear and Height are the bigger alternatives.",
    verdictBad: 'Yoursite: not mentioned',
    verdictGood: 'Yoursite: cited first',
    flipToFixed: 'Fix my site',
    flipToBroken: 'Show it broken again',
    resultLede: 'Grouped by what it affects, with the costliest area first.',
    findingsTitle: 'What to fix',
    indexLede: "Every site we've scanned in this category, ranked by how readable it is to the clients that answer questions about it.",
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

export const FIX_FILES = ['llms.txt', 'robots.txt', 'waf-rule.txt', 'pricing.jsonld'] as const;
