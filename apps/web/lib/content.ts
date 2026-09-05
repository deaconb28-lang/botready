/**
 * The public pages, and the one place that knows what each of them is.
 *
 * Four separate outputs are generated from this list — the sitemap, the
 * `Last-Modified` header, the markdown representation of each page, and the
 * llms.txt — and they were drifting apart when each held its own copy. A page
 * added here appears in all four or in none of them.
 *
 * `updated` is the date the page's own content last changed, maintained by
 * hand and checked by a test against the git history of `sources`. It is not
 * the build time: stamping every URL with the deploy date is the thing
 * `sitemap_lastmod_real` fails sites for, and we are not going to fail our own
 * check while selling the fix for it.
 */

export interface PublicPage {
  path: string;
  title: string;
  /** The meta description, and the first line of the markdown representation. */
  description: string;
  /** ISO date, no time. The day this page's content last changed. */
  updated: string;
  /** The files whose git history is the evidence for `updated`. */
  sources: string[];
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
  /** In the sitemap and in llms.txt. Off for pages that are not content. */
  listed: boolean;
}

export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    title: 'Are you BotReady?',
    description:
      'Get found by AI agents. See how well your site can be seen by the assistants your customers ask, then fix what is hiding you. No engineer, no rebuild, no marketing budget.',
    updated: '2026-09-05',
    sources: ['apps/web/app/page.tsx', 'apps/web/components/home'],
    changeFrequency: 'weekly',
    priority: 1,
    listed: true,
  },
  {
    path: '/what-we-check',
    title: 'What we check',
    description:
      'The full check catalog and the weights, published, so the score can be argued with rather than believed.',
    updated: '2026-09-02',
    sources: ['apps/web/app/what-we-check', 'packages/core/checks.json'],
    changeFrequency: 'monthly',
    priority: 0.8,
    listed: true,
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: 'The diagnosis is free. The files are not. A one-time fix pack and monthly monitoring.',
    updated: '2026-09-05',
    sources: ['apps/web/app/pricing'],
    changeFrequency: 'monthly',
    priority: 0.7,
    listed: true,
  },
  {
    path: '/docs',
    title: 'API and docs',
    description:
      'The public scan API, the fields it returns, the rate limits, and the machine-readable files this site serves.',
    updated: '2026-09-04',
    sources: ['apps/web/app/docs'],
    changeFrequency: 'monthly',
    priority: 0.75,
    listed: true,
  },
  {
    path: '/bot',
    title: 'Our crawler',
    description: 'What BotreadyBot/1.0 requests, how to block it, and the things it will never do to get past a block.',
    updated: '2026-08-28',
    sources: ['apps/web/app/bot'],
    changeFrequency: 'monthly',
    priority: 0.6,
    listed: true,
  },
  {
    path: '/sign-in',
    title: 'Sign in',
    description: 'Continue with Google. There is no password to lose and no trial to cancel.',
    updated: '2026-08-26',
    sources: ['apps/web/app/sign-in'],
    changeFrequency: 'yearly',
    priority: 0.2,
    listed: false,
  },
];

export function pageFor(path: string): PublicPage | undefined {
  const normalised = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
  return PUBLIC_PAGES.find((p) => p.path === normalised);
}

/** `/pricing` -> `/pricing.md`, and `/` -> `/index.md`. */
export function markdownPathFor(path: string): string {
  return path === '/' ? '/index.md' : `${path}.md`;
}

/** The newest date in the list, used where one date has to stand for the site. */
export function newestUpdate(): string {
  return PUBLIC_PAGES.map((p) => p.updated).sort().at(-1) ?? '2026-01-01';
}

/** HTTP-date form, for `Last-Modified`. */
export function httpDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}
