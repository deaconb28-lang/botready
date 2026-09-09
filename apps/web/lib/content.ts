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

import { BLOG_POSTS } from './blog-posts';

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

/**
 * The posts, as public pages.
 *
 * Derived rather than listed, so a post added to blog-posts.ts appears in the
 * sitemap, in llms.txt, in the markdown negotiation and in the `Last-Modified`
 * header without anybody remembering to add it in four places. That is the
 * whole argument of this file applied one level down.
 *
 * `priority` sits below the marketing pages and above sign-in, and
 * `changeFrequency` is yearly because a post that quotes a dated figure is not
 * rewritten when the figure moves — it links to the live one. Telling a
 * crawler to come back weekly for a page that will not have changed is the
 * same kind of false claim as a build-stamped lastmod.
 */
const BLOG_PAGES: PublicPage[] = BLOG_POSTS.map((post) => ({
  path: `/blog/${post.slug}`,
  title: post.title,
  description: post.dek,
  updated: post.updated,
  sources: ['apps/web/lib/blog-posts.ts'],
  changeFrequency: 'yearly' as const,
  priority: 0.6,
  listed: true,
}));

export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    title: 'Are you BotReady?',
    description:
      'ChatGPT, Claude and Perplexity answer questions about your category daily. See what they get from your site, and the files that fix it.',
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
      'All 25 checks and every weight, published, so you can argue with the score instead of taking our word for it.',
    updated: '2026-09-09',
    sources: ['apps/web/app/what-we-check', 'packages/core/checks.json'],
    changeFrequency: 'monthly',
    priority: 0.8,
    listed: true,
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: 'The check is free and always will be. The fix pack is $15 once, and ten domains watched every week on the agency plan is $29 a month.',
    updated: '2026-09-07',
    sources: ['apps/web/app/pricing'],
    changeFrequency: 'monthly',
    priority: 0.7,
    listed: true,
  },
  {
    path: '/blog',
    title: 'Notes from the scanner',
    description:
      'What we found measuring how legible websites are to AI agents, and how the measuring works. Ten posts, every figure taken over sites we actually scanned.',
    updated: '2026-09-09',
    sources: ['apps/web/app/blog', 'apps/web/lib/blog-posts.ts'],
    changeFrequency: 'weekly',
    priority: 0.85,
    listed: true,
  },
  {
    path: '/stats',
    title: 'What we have measured',
    description:
      'Refusal rates by client, the checks sites fail most, and the median score by kind of business — every figure an aggregate over real scans, with the count it was taken over.',
    updated: '2026-09-09',
    sources: ['apps/web/app/stats', 'apps/web/lib/stats-data.ts', 'db/migrations/0016_public_stats.sql'],
    changeFrequency: 'daily',
    priority: 0.8,
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
  ...BLOG_PAGES,
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
