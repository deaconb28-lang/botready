/**
 * The classifier is only useful if it is reluctant. Most of these assert that
 * it declines rather than that it decides: a site filed under a guess is worse
 * for the index than a site left out of it.
 */

import { describe, expect, it } from 'vitest';

import { classifySegment, type CheckResult } from '../src';

function results(parts: Partial<Record<string, Record<string, unknown>>>): CheckResult[] {
  return Object.entries(parts).map(([key, observed]) => ({
    key,
    status: key === 'api_docs_reachable' && observed?.url ? 'pass' : 'pass',
    observed: observed ?? {},
    durationMs: 0,
  }));
}

const page = (url: string, title = '', description = '') => ({ url, title, description, status: 200 });

describe('classifySegment', () => {
  it('says nothing about a site with nothing to go on', () => {
    expect(classifySegment([])).toBeNull();
    expect(
      classifySegment(
        results({
          jsonld_present: { types: ['WebSite', 'Organization'] },
          title_meta_distinct: { pages: [page('https://example.com/', 'Example', 'A company')] },
        }),
      ),
    ).toBeNull();
  });

  it('reads a cart as a shop', () => {
    const verdict = classifySegment(
      results({
        title_meta_distinct: { pages: [page('https://shop.example/'), page('https://shop.example/cart')] },
      }),
    );
    expect(verdict?.segment).toBe('ecommerce');
    expect(verdict?.reasons[0]).toContain('cart');
  });

  it('reads a published schema.org type as the site describing itself', () => {
    expect(classifySegment(results({ jsonld_present: { types: ['NewsArticle'] } }))?.segment).toBe('media');
    expect(classifySegment(results({ jsonld_present: { types: ['OnlineStore'] } }))?.segment).toBe('ecommerce');
    expect(classifySegment(results({ jsonld_present: { types: ['SoftwareApplication'] } }))?.segment).toBe('saas');
  });

  it('finds the type in the raw HTML as well as the rendered DOM', () => {
    expect(classifySegment(results({ jsonld_present: { types: [], types_in_raw_html: ['Store'] } }))?.segment).toBe(
      'ecommerce',
    );
  });

  it('does not call every site with docs a developer tool', () => {
    // Docs plus nothing else is most of the internet. Without developer
    // wording it is not evidence, and the offers below decide it instead.
    const verdict = classifySegment(
      results({
        api_docs_reachable: { hops: 1, url: 'https://example.com/docs' },
        pricing_structured: { offer_nodes: 2 },
        title_meta_distinct: { pages: [page('https://example.com/', 'Example', 'Invoicing for small teams')] },
      }),
    );
    expect(verdict?.segment).toBe('saas');
  });

  it('does call one a developer tool when the site says so in its own title', () => {
    const verdict = classifySegment(
      results({
        api_docs_reachable: { hops: 1, url: 'https://example.com/docs' },
        title_meta_distinct: {
          pages: [page('https://example.com/', 'Example — the open source deploy CLI', 'Ship from your terminal')],
        },
      }),
    );
    expect(verdict?.segment).toBe('devtools');
  });

  it('prefers the shop over the subscription when a site is both', () => {
    // Priced offers and a cart is a shop. Only offers is a subscription.
    const verdict = classifySegment(
      results({
        pricing_structured: { offer_nodes: 3 },
        title_meta_distinct: { pages: [page('https://example.com/'), page('https://example.com/checkout')] },
      }),
    );
    expect(verdict?.segment).toBe('ecommerce');
  });

  it('prefers the narrower answer when a dev tool also looks like SaaS', () => {
    const verdict = classifySegment(
      results({
        jsonld_present: { types: ['SoftwareApplication'] },
        api_docs_reachable: { hops: 1, url: 'https://example.com/api' },
        title_meta_distinct: { pages: [page('https://example.com/', 'Example API', 'Webhooks for developers')] },
      }),
    );
    expect(verdict?.segment).toBe('devtools');
  });

  it('gives its reasons, so a wrong answer can be argued with', () => {
    const verdict = classifySegment(results({ jsonld_present: { types: ['NewsArticle'] } }));
    expect(verdict?.reasons).toEqual(['publishes schema.org NewsArticle']);
  });

  it('ignores a malformed observed payload rather than throwing', () => {
    expect(() =>
      classifySegment(results({ jsonld_present: { types: 'nope' }, title_meta_distinct: { pages: 'nope' } })),
    ).not.toThrow();
  });
});
