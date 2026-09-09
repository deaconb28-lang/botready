/**
 * Why a scan stopped early, and whose problem that is.
 *
 * "1 of 6 allowed" was the most confusing number on a result page: 43 of the
 * 342 complete scans in the corpus read exactly one page, and the report gave
 * the reader no way to tell whether the limit was their site or our scanner.
 *
 * Most of what is asserted here is that distinction, because getting it wrong
 * in the generous direction hides a real finding and getting it wrong in the
 * other direction takes points off a site for our own timeout.
 */

import { describe, expect, it } from 'vitest';

import { CRAWL_ACCOUNT_VERSION, crawlAccount, crawlLimit, type CrawlObserved } from '../src/crawl';

const observed = (over: Partial<CrawlObserved> = {}): CrawlObserved => ({
  budget: 5,
  pages_read: 0,
  raw_links: 0,
  rendered_links: 0,
  off_origin_links: 0,
  sitemap_urls: 0,
  robots_blocked: 0,
  attempted: 0,
  failed: 0,
  no_response: 0,
  render_failed: false,
  ...over,
});

describe('crawlLimit', () => {
  it('calls a full crawl our cap, not the site', () => {
    const o = observed({ pages_read: 5, raw_links: 40, attempted: 5 });
    expect(crawlLimit(o)).toBe('budget');
    expect(crawlAccount(o).onTheSite).toBe(false);
  });

  it('names the JavaScript case when the raw HTML has no links and the DOM does', () => {
    // The finding this product exists for, in a second place: the words are
    // there in a browser and the way to the rest of the site is not.
    const o = observed({ rendered_links: 34 });
    expect(crawlLimit(o)).toBe('links_js_only');
    expect(crawlAccount(o).onTheSite).toBe(true);
    expect(crawlAccount(o).sentence).toContain('34 links appeared only after we ran the page in a browser');
  });

  it('separates no links at all from links that all leave the site', () => {
    expect(crawlLimit(observed({ off_origin_links: 22 }))).toBe('links_off_origin');
    expect(crawlLimit(observed())).toBe('no_internal_links');
  });

  it('says robots.txt when robots.txt is the reason', () => {
    // Candidates existed and we did not ask for them. Reporting this as "no
    // links" would blame the site for a shape it does not have.
    const o = observed({ raw_links: 12, robots_blocked: 12 });
    expect(crawlLimit(o)).toBe('robots_disallowed');
    expect(crawlAccount(o).sentence).toContain('we obeyed it');
  });

  it('does not blame robots.txt when there was nothing to block', () => {
    expect(crawlLimit(observed({ robots_blocked: 3, raw_links: 0, rendered_links: 0 }))).toBe(
      'no_internal_links',
    );
  });

  it('counts a site with three pages as complete rather than truncated', () => {
    // A brochure site is not a broken site. This is the case that must not
    // become a finding, and it is the most common one after budget.
    const o = observed({ pages_read: 2, raw_links: 2, attempted: 2 });
    expect(crawlLimit(o)).toBe('partial');
    expect(crawlAccount(o).onTheSite).toBe(false);
  });
});

describe('a crawl where every fetch failed', () => {
  it('is the site when the pages answered with errors', () => {
    const o = observed({ raw_links: 4, attempted: 4, failed: 4, no_response: 0 });
    expect(crawlLimit(o)).toBe('fetches_failed');
    expect(crawlAccount(o).onTheSite).toBe(true);
    expect(crawlAccount(o).sentence).toContain('returned an error');
  });

  it('is ours when nothing answered at all', () => {
    // A dead network on our side looks identical to a dead site from the
    // status code alone, and charging points for it would make the score a
    // measure of our own infrastructure.
    const o = observed({ raw_links: 4, attempted: 4, failed: 4, no_response: 4 });
    expect(crawlAccount(o).onTheSite).toBe(false);
    expect(crawlAccount(o).sentence).toContain('costs you nothing');
  });
});

describe('the sentence', () => {
  it('is a whole sentence in every case, and carries the version', () => {
    const cases: CrawlObserved[] = [
      observed({ pages_read: 5 }),
      observed({ pages_read: 2, attempted: 2 }),
      observed({ rendered_links: 1 }),
      observed(),
      observed({ off_origin_links: 3 }),
      observed({ raw_links: 2, robots_blocked: 2 }),
      observed({ raw_links: 1, attempted: 1, failed: 1 }),
      observed({ raw_links: 1, attempted: 1, failed: 1, no_response: 1 }),
    ];
    for (const o of cases) {
      const account = crawlAccount(o);
      expect(account.version).toBe(CRAWL_ACCOUNT_VERSION);
      expect(account.sentence.endsWith('.'), account.sentence).toBe(true);
      expect(account.sentence.length).toBeGreaterThan(40);
    }
  });

  it('says link rather than links at one', () => {
    expect(crawlAccount(observed({ rendered_links: 1 })).sentence).toContain('1 link appeared');
    expect(crawlAccount(observed({ raw_links: 1, robots_blocked: 1 })).sentence).toContain('1 page we would');
  });
});
