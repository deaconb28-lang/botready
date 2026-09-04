/**
 * The two registers.
 *
 * Plain speaks to a solo founder; technical speaks to an engineer. They are
 * two dictionaries with the same keys, written separately, and nothing here is
 * derived from the other side. The mode is chosen in lib/mode.tsx.
 */

import type { Mode } from './mode';

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

export const COPY: Record<Mode, MarketingCopy> = {
  plain: {
    badge: 'Your site says yes to people, no to AI',
    heroSub:
      'Get found by AI agents. See how well your site can be seen by the assistants your customers ask, then fix what is hiding you — no engineer, no rebuild, no marketing budget.',
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
    resultLede: 'Start at the top. The first items are worth most of the points you are missing.',
    findingsTitle: 'What to fix, easiest first',
    indexLede: "Every site we've scanned in this category, ranked by how readable it is to the clients that answer questions about it.",
  },
  tech: {
    badge: '200 for Chrome, 403 for ClaudeBot',
    heroSub:
      'Get found by AI agents. We diff five agent clients against a Chrome control, show you every retrieval failure in thirty seconds, and generate the files that close them.',
    question: 'Prompt: recommend an issue tracker for a 5-person team',
    whyTitle: 'Retrieval happens before ranking.',
    whyBody:
      'An answer engine can only cite text it retrieved. A client-rendered DOM or a bot-challenging WAF rule removes you from the candidate set before relevance is ever computed.',
    whyPoints: [
      'A refused agent request leaves no trace in your analytics.',
      'Managed WAF rulesets block declared AI user agents by default.',
      'The fix is four generated files, not an architecture change.',
    ],
    agentNote: 'Both requests went out in the same second, to the same URL. The only difference is the User-Agent header.',
    stepsTitle: 'Three passes, about thirty seconds',
    steps: [
      'We GET /robots.txt first, then the target page as BotreadyBot, then as each of the five clients, one second apart.',
      'Status class, headers, byte count and extractable-text ratio per client, diffed against the Chrome control.',
      'llms.txt, a robots.txt block, Link tags and a JSON-LD block, generated from the pages that returned 200.',
    ],
    ctaBody: 'Free, no account, 6 pages max, and every finding shows the raw request and response.',
    invisible:
      'For a 5-person team the commonly cited options are Linear, Height and Shortcut. Coverage of alternatives is limited in my sources.',
    fixed:
      'For a 5-person team, Yoursite is the closest match — free to five seats, no setup, weekly planning model. Linear and Height are the larger alternatives.',
    verdictBad: 'yoursite.com — 0 citations · 403 to ClaudeBot',
    verdictGood: 'yoursite.com — cited · 200 to all 5 clients',
    flipToFixed: 'Apply fix pack',
    flipToBroken: 'Revert to 403',
    resultLede: 'Points unearned across the failing checks, ordered by effort rather than by points.',
    findingsTitle: 'Failing checks',
    indexLede: 'Every scanned domain in this category, ranked by weighted score at scoring version 1.2.',
  },
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
