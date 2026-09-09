/**
 * The page crawl: what it asks for, and what it refuses to ask for.
 *
 * The robots.txt assertions here are the load-bearing ones. Our own crawler
 * page promises that we read robots.txt on every scan and stop, and until now
 * that promise was kept only for the target URL — a site that allowed `/` and
 * disallowed `/search` got its `/search` fetched. Constraint 1 says this is
 * checked in CI rather than asserted on a marketing page, so it is checked
 * here, on the requests the crawl actually issues.
 *
 * The rest is the truncation accounting the result page reads: whether a scan
 * that read one page did so because of the site or because of us.
 */

import { describe, expect, it, vi } from 'vitest';

import { crawlLimit } from '@botready/core';

import { parseRobots } from '../robots';
import { crawlExtraPages, rankInternalLinks, type CrawlInput } from './document';

vi.mock('../fetcher', async () => {
  const actual = await vi.importActual<typeof import('../fetcher')>('../fetcher');
  return {
    ...actual,
    // No delay between requests in a test. The real one is a second apart and
    // that constraint is asserted where it lives, in the scan.
    crawlSequentially: async (urls: string[], _delay: number, fetch: (u: string) => Promise<unknown>) => {
      const out = [];
      for (const url of urls) out.push(await fetch(url));
      return out;
    },
    guardedFetch: async (url: string) => ({
      url,
      requestedUrl: url,
      status: url.includes('/dead') ? 404 : 200,
      headers: {},
      body: `<html><head><title>${url}</title></head><body><main>words</main></body></html>`,
      bytes: 60,
      ttfbMs: 1,
      totalMs: 2,
      redirects: [],
      truncated: false,
    }),
  };
});

const input = (over: Partial<CrawlInput> = {}): CrawlInput => ({
  rawLinks: [],
  renderedLinks: [],
  sitemapUrls: [],
  robots: null,
  renderFailed: false,
  ...over,
});

const TARGET = 'https://example.com/';

describe('robots.txt, on every candidate rather than only the target', () => {
  it('does not request a path its robots.txt disallows', async () => {
    const robots = parseRobots('User-agent: *\nDisallow: /search\nDisallow: /admin\n');
    const result = await crawlExtraPages(
      TARGET,
      input({
        rawLinks: ['/pricing', '/search?q=a', '/admin/users', '/about'],
        renderedLinks: ['/pricing', '/search?q=a', '/admin/users', '/about'],
        robots,
      }),
    );

    const requested = result.pages.map((p) => p.url);
    expect(requested).toContain('https://example.com/pricing');
    expect(requested).toContain('https://example.com/about');
    expect(requested.some((u) => u.includes('/search'))).toBe(false);
    expect(requested.some((u) => u.includes('/admin'))).toBe(false);
    expect(result.observed.robots_blocked).toBe(2);
  });

  it('records robots as the reason when it blocked everything', async () => {
    const robots = parseRobots('User-agent: BotreadyBot\nDisallow: /\n');
    const result = await crawlExtraPages(
      TARGET,
      input({ rawLinks: ['/a', '/b', '/c'], renderedLinks: ['/a', '/b', '/c'], robots }),
    );
    expect(result.pages).toHaveLength(0);
    expect(result.observed.attempted).toBe(0);
    expect(crawlLimit(result.observed)).toBe('robots_disallowed');
  });

  it('fetches everything when there is no robots.txt to obey', async () => {
    // An absent robots.txt is not a disallow. Treating it as one would be a
    // different bug in the same place.
    const result = await crawlExtraPages(TARGET, input({ rawLinks: ['/a'], renderedLinks: ['/a'] }));
    expect(result.observed.attempted).toBe(1);
  });
});

describe('the sitemap as a fallback source', () => {
  it('fills the budget from the sitemap when the homepage runs out of links', async () => {
    const result = await crawlExtraPages(
      TARGET,
      input({
        rawLinks: ['/pricing'],
        renderedLinks: ['/pricing'],
        sitemapUrls: [
          'https://example.com/services',
          'https://example.com/team',
          'https://example.com/contact',
          'https://example.com/faq',
          'https://example.com/careers',
        ],
      }),
    );
    // Five requested: one from the homepage, four from the sitemap.
    expect(result.observed.attempted).toBe(5);
    expect(result.pagesCrawled).toBe(6);
    expect(result.pages[0]?.url).toBe('https://example.com/pricing');
  });

  it('does not let the sitemap hide a homepage with no links in its HTML', async () => {
    // The finding is about what a non-executing client can follow from the
    // page. A sitemap it would have to think to ask for does not answer that,
    // so raw_links stays 0 and the reason stays the JavaScript one.
    const result = await crawlExtraPages(
      TARGET,
      input({
        rawLinks: [],
        renderedLinks: ['/a', '/b'],
        sitemapUrls: ['https://example.com/c'],
      }),
    );
    expect(result.observed.raw_links).toBe(0);
    expect(result.observed.rendered_links).toBe(2);
    // Pages were read, so the limit is the budget rather than the shape of the
    // links — the check reads raw_links, and the account reads both.
    expect(result.observed.pages_read).toBeGreaterThan(0);
  });
});

describe('the accounting', () => {
  it('counts pages read rather than pages requested', async () => {
    // Five dead links used to report "6 of 6 allowed", which said we had read
    // the site when we had read one page of it.
    const result = await crawlExtraPages(
      TARGET,
      input({ rawLinks: ['/dead-1', '/dead-2'], renderedLinks: ['/dead-1', '/dead-2'] }),
    );
    expect(result.observed.attempted).toBe(2);
    expect(result.observed.failed).toBe(2);
    expect(result.observed.pages_read).toBe(0);
    expect(result.pagesCrawled).toBe(1);
    expect(crawlLimit(result.observed)).toBe('fetches_failed');
  });

  it('counts links that leave the site apart from links that do not exist', async () => {
    const result = await crawlExtraPages(
      TARGET,
      input({
        rawLinks: ['https://instagram.com/x', 'https://booking.example.net/y', 'mailto:a@b.c'],
        renderedLinks: ['https://instagram.com/x', 'https://booking.example.net/y', 'mailto:a@b.c'],
      }),
    );
    expect(result.observed.off_origin_links).toBe(2); // mailto: is not a page
    expect(result.observed.raw_links).toBe(0);
    expect(crawlLimit(result.observed)).toBe('links_off_origin');
  });

  it('never reports more pages than the cap allows', async () => {
    const many = Array.from({ length: 40 }, (_, i) => `/page-${i}`);
    const result = await crawlExtraPages(TARGET, input({ rawLinks: many, renderedLinks: many }));
    expect(result.pagesCrawled).toBeLessThanOrEqual(6);
    expect(result.observed.attempted).toBe(5);
  });
});

describe('rankInternalLinks', () => {
  it('keeps preferred paths first and drops what is not a page', () => {
    const ranked = rankInternalLinks(
      ['/blog/x', '/logo.png', '/pricing', 'https://other.com/a', '/pricing#plans', '/'],
      TARGET,
      'https://example.com',
    );
    expect(ranked[0]).toBe('https://example.com/pricing');
    expect(ranked).not.toContain('https://example.com/logo.png');
    expect(ranked.filter((u) => u.endsWith('/pricing'))).toHaveLength(1);
  });
});
