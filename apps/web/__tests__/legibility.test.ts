/**
 * The checks we sell, applied to ourselves.
 *
 * A scan of botready.dev scored 57 and a C, which is an awkward number for a
 * site whose whole argument is that this is measurable and worth fixing. These
 * assertions are the parts of that fix a unit test can hold: that every public
 * page has a markdown representation and a distinct description, that the
 * sitemap dates are real rather than the deploy timestamp, that llms.txt only
 * names URLs this app actually serves, and that the middleware which does the
 * content negotiation is pointed at every page and only at pages.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PUBLIC_PAGES, httpDate, markdownPathFor, newestUpdate, pageFor } from '../lib/content';
import { llmsFullTxt, llmsTxt, markdownFor } from '../lib/markdown';
import { SITE } from '../lib/site';

const middlewareSource = readFileSync(
  fileURLToPath(new URL('../middleware.ts', import.meta.url)),
  'utf8',
);

/** Paths this app serves that are not registered pages. Kept in one place. */
const OTHER_SERVED_PATHS = new Set([
  '/llms.txt',
  '/llms-full.txt',
  '/openapi.json',
  '/.well-known/agent.json',
  '/.well-known/ai-plugin.json',
  '/sitemap.xml',
  '/robots.txt',
  '/logo.svg',
  '/index/saas',
  '/index/devtools',
  '/index/ecommerce',
  '/index/media',
]);

describe('the public page list', () => {
  it('gives every page a markdown representation', () => {
    for (const page of PUBLIC_PAGES) {
      const markdown = markdownFor(page.path);
      expect(markdown, `no markdown for ${page.path}`).toBeTruthy();
      expect(markdown).toContain(`# ${page.title}`);
      expect(markdown).toContain(page.description);
    }
  });

  it('gives every page a distinct title and description', () => {
    // title_meta_distinct fails a site outright for two pages sharing a title,
    // and warns for two sharing a description. Six pages get crawled.
    const titles = PUBLIC_PAGES.map((p) => p.title.toLowerCase());
    const descriptions = PUBLIC_PAGES.map((p) => p.description.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const page of PUBLIC_PAGES) {
      expect(page.description.length, `${page.path} description is too short`).toBeGreaterThan(60);
    }
  });

  it('dates every page in the past, and not all on the same day', () => {
    // sitemap_lastmod_real fails when every lastmod is identical or in the
    // future — which is what you get from stamping the build onto every URL.
    const dates = PUBLIC_PAGES.map((p) => p.updated);
    const today = new Date().toISOString().slice(0, 10);
    for (const date of dates) {
      expect(date, `${date} is not a plain ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(date <= today, `${date} is in the future`).toBe(true);
    }
    expect(new Set(dates).size).toBeGreaterThan(1);
  });

  it('normalises a trailing slash when looking a page up', () => {
    expect(pageFor('/pricing/')?.path).toBe('/pricing');
    expect(pageFor('/')?.path).toBe('/');
    expect(pageFor('/nothing-here')).toBeUndefined();
  });

  it('turns a page path into its markdown URL', () => {
    expect(markdownPathFor('/')).toBe('/index.md');
    expect(markdownPathFor('/pricing')).toBe('/pricing.md');
  });

  it('formats an HTTP date for Last-Modified', () => {
    expect(httpDate('2026-08-30')).toBe('Sun, 30 Aug 2026 00:00:00 GMT');
    expect(newestUpdate()).toBe(PUBLIC_PAGES.map((p) => p.updated).sort().at(-1));
  });
});

describe('llms.txt', () => {
  const links = [...llmsTxt().matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]!);

  it('names only URLs this app serves', () => {
    // A file full of dead links is worse than no file: an agent that trusts it
    // spends its budget on 404s. The check opens the first five.
    expect(links.length).toBeGreaterThan(4);
    for (const link of links) {
      expect(link.startsWith(SITE.origin), `${link} is not on this origin`).toBe(true);
      const path = link.slice(SITE.origin.length);
      const known =
        OTHER_SERVED_PATHS.has(path) ||
        PUBLIC_PAGES.some((p) => markdownPathFor(p.path) === path || p.path === path);
      expect(known, `${path} is not a path this app serves`).toBe(true);
    }
  });

  it('lists every listed page and no unlisted one', () => {
    for (const page of PUBLIC_PAGES) {
      const url = `${SITE.origin}${markdownPathFor(page.path)}`;
      expect(links.includes(url), `${page.path} listed=${page.listed}`).toBe(page.listed);
    }
  });

  it('inlines every listed page in llms-full.txt', () => {
    const full = llmsFullTxt();
    for (const page of PUBLIC_PAGES.filter((p) => p.listed)) {
      expect(full).toContain(`# ${page.title}`);
    }
  });
});

describe('the middleware', () => {
  it('matches every public page and nothing else', () => {
    // The matcher cannot be computed at build time — Next reads it statically —
    // so it is a hand-written list, and this is what stops it drifting from
    // lib/content.ts the next time a page is added.
    const matcher = /matcher:\s*\[([^\]]*)\]/.exec(middlewareSource)?.[1] ?? '';
    const paths = [...matcher.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    expect(paths.sort()).toEqual(PUBLIC_PAGES.map((p) => p.path).sort());
  });
});
