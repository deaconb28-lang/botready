/**
 * The scan, end to end, against a real HTTP server on the loopback interface
 * and a real Chromium.
 *
 * These are slow tests and they are worth it. The two findings the product is
 * built on — a 403 to one user agent from the same address that answered
 * another, and a page whose text only exists after a script runs — cannot be
 * reproduced by a mocked fetcher without the mock becoming the thing under test.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CHECK_KEYS, catalog } from '@botready/core';

import { startFixture, type Fixture, type FixtureMode } from './__fixtures__/server';
import { scan } from './scan';
import { closeBrowser } from './passes/render';

let fixture: Fixture;

/**
 * One scan per fixture mode, reused. A full scan launches Chromium and makes
 * twenty-odd requests, so re-running one per assertion turns this file into
 * four minutes of waiting for the same answer.
 */
const scans = new Map<FixtureMode, Awaited<ReturnType<typeof scan>>>();

async function scanOnce(mode: FixtureMode) {
  const cached = scans.get(mode);
  if (cached) return cached;
  fixture.setMode(mode);
  const batches: number[][] = [];
  const outcome = await scan(`${fixture.origin}/`, async (batch) => {
    batches.push(batch.map(() => 1));
  });
  batchesByMode.set(mode, batches.map((b) => b.length));
  // The request log belongs to this scan, so it is captured alongside it.
  requestsByMode.set(mode, [...fixture.requests]);
  scans.set(mode, outcome);
  return outcome;
}

const requestsByMode = new Map<FixtureMode, Fixture['requests']>();
/** How many checks each progress batch carried, in the order they arrived. */
const batchesByMode = new Map<FixtureMode, number[]>();

function requestsFor(mode: FixtureMode): Fixture['requests'] {
  return requestsByMode.get(mode) ?? [];
}

beforeAll(async () => {
  fixture = await startFixture('good');
  // The guard refuses loopback, which is the whole reason it exists. The
  // allowlist is read fresh on every call and is inert in production.
  process.env.SCANNER_ALLOW_PRIVATE_HOSTS = `127.0.0.1:${fixture.port}`;
  // The one second gap is a product constraint on real scans, not on a test
  // that makes twenty of them against its own server.
  process.env.SCANNER_PAGE_DELAY_MS = '0';
});

afterAll(async () => {
  await closeBrowser();
  await fixture.close();
  delete process.env.SCANNER_ALLOW_PRIVATE_HOSTS;
  delete process.env.SCANNER_PAGE_DELAY_MS;
});

describe('a site that an agent can read', () => {
  it('completes, and every key it emits exists in checks.json', async () => {
    const outcome = await scanOnce('good');

    expect(outcome.status).toBe('complete');
    expect(outcome.results.length).toBeGreaterThan(0);

    // Nothing in the scanner may invent a check key. The catalog is the
    // contract, and a typo here would silently drop a check from the score.
    for (const result of outcome.results) {
      expect(CHECK_KEYS, `${result.key} is not in checks.json`).toContain(result.key);
    }

    // And no key twice: evidence has a unique (scan_id, check_key).
    const keys = outcome.results.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('emits nothing that looks like a score or a grade', async () => {
    // Evidence and scoring are separate. A point value or a letter appearing in
    // `observed` would mean the scanner had formed an opinion, which is the one
    // thing it is not allowed to do.
    const forbidden = /\b(points?|score|grade|weight|penalt)/i;
    const outcome = await scanOnce('good');
    for (const key of Object.keys(observedFrom(outcome))) {
      expect(key, `${key} reads like a judgement`).not.toMatch(forbidden);
    }
  });

  it('finds robots.txt, the sitemap, llms.txt and the agent manifest', async () => {
    const outcome = await scanOnce('good');
    const byKey = index(outcome);

    expect(byKey.robots_present?.status).toBe('pass');
    expect(byKey.sitemap_present?.status).toBe('pass');
    expect(byKey.sitemap_present?.observed.url_count).toBe(5);
    expect(byKey.llms_txt_present?.status).toBe('pass');
    expect(byKey.agent_manifest?.status).toBe('pass');
    expect(byKey.agent_manifest?.observed.well_known_paths_found).toContain(
      '/.well-known/agent.json',
    );
  });

  it('sees every client get the same answer', async () => {
    const outcome = await scanOnce('good');
    const parity = index(outcome).agent_status_parity;

    expect(parity?.status).toBe('pass');
    const perAgent = parity?.observed.per_agent as Record<string, { status: number }>;
    for (const agent of catalog.agents) {
      expect(perAgent[agent.id]?.status, `${agent.id} did not get a 200`).toBe(200);
    }
  });

  it('records the facts the fix pack is built from', async () => {
    const outcome = await scanOnce('good');
    const byKey = index(outcome);

    expect(byKey.cache_headers?.observed.etag).toBe('"a1b2c3"');
    expect(byKey.canonical_og?.observed.og_missing).toEqual([]);
    expect(byKey.jsonld_present?.observed.types).toContain('Organization');
    expect(byKey.markdown_alternate?.status).toBe('pass');
    expect(byKey.content_negotiation?.status).toBe('pass');
    expect(byKey.sitemap_lastmod_real?.status).toBe('pass');
  });
});

describe('a site whose robots.txt disallows us', () => {
  it('returns blocked and stops without reading anything else', async () => {
    const outcome = await scanOnce('robots-blocked');

    expect(outcome.status).toBe('blocked');
    expect(outcome.pagesCrawled).toBe(0);
    expect(outcome.blockedBy).toContain('robots.txt');

    // The proof that we obeyed it: robots.txt is the only path we asked for.
    const paths = new Set(requestsFor('robots-blocked').map((r) => r.path));
    expect([...paths]).toEqual(['/robots.txt']);
  });

  it('still reports what the file says about the other agents', async () => {
    const outcome = await scanOnce('robots-blocked');
    const rules = index(outcome).robots_agent_rules;

    // The file blocks us and allows everyone else, so the site itself passes
    // this check. Our own exclusion is not a mark against them.
    expect(rules?.status).toBe('pass');
    expect(outcome.results.map((r) => r.key)).toContain('robots_present');
  });
});

describe('a site whose WAF refuses bots', () => {
  it('returns blocked, and records the 403 as a fact rather than working around it', async () => {
    const outcome = await scanOnce('waf-blocked');

    expect(outcome.status).toBe('blocked');
    expect(outcome.blockedBy).toContain('403');
    expect(outcome.blockedBy).toContain('cf-mitigated');

    // Every request we made carried our own user agent. No spoofing, ever.
    const spoofed = requestsFor('waf-blocked').filter((r) => /Chrome\/141/.test(r.userAgent));
    expect(spoofed).toEqual([]);
  });

  it('produces a different set of results from a site that lets us in', async () => {
    const good = await scanOnce('good');
    const blocked = await scanOnce('waf-blocked');

    expect(good.status).not.toBe(blocked.status);
    expect(good.results.length).toBeGreaterThan(blocked.results.length);
    expect(index(good).llms_txt_present?.status).toBe('pass');
    expect(index(blocked).llms_txt_present).toBeUndefined();
  });
});

describe('the JS dependency ratio', () => {
  it('is near zero for a server-rendered site', async () => {
    const outcome = await scanOnce('good');
    const ratio = index(outcome).js_dependency_ratio;

    expect(ratio?.status).toBe('pass');
    expect(ratio?.observed.ratio as number).toBeGreaterThanOrEqual(0);
    expect(ratio?.observed.ratio as number).toBeLessThanOrEqual(0.3);
  });

  it('is above 0.8 for a client-rendered one', async () => {
    const outcome = await scanOnce('spa');
    const ratio = index(outcome).js_dependency_ratio;

    expect(ratio?.status).toBe('fail');
    expect(ratio?.observed.ratio as number).toBeGreaterThan(0.8);
    // Both counts are recorded, because the finding is the pair and not the
    // quotient. "312 characters raw, 9,240 rendered" is the sentence that lands.
    expect(ratio?.observed.raw_chars as number).toBeLessThan(
      ratio?.observed.rendered_chars as number,
    );
  });
});

describe('the page budget', () => {
  it('reads at most six distinct pages', async () => {
    const outcome = await scanOnce('good');
    expect(outcome.pagesCrawled).toBeLessThanOrEqual(6);

    // Counted independently of what the scan reported: distinct content paths
    // the fixture actually served.
    const contentPaths = new Set(
      requestsFor('good')
        .map((r) => r.path)
        .filter((path) => !/^\/(robots\.txt|sitemap\.xml|llms(-full)?\.txt|\.well-known\/)/.test(path)),
    );
    expect(contentPaths.size).toBeLessThanOrEqual(6);
  });
});

// ------------------------------------------------------------------ helpers

function index(outcome: Awaited<ReturnType<typeof scan>>) {
  return Object.fromEntries(outcome.results.map((r) => [r.key, r])) as Record<
    string,
    { status: string; observed: Record<string, unknown> } | undefined
  >;
}

function observedFrom(outcome: Awaited<ReturnType<typeof scan>>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const result of outcome.results) Object.assign(merged, result.observed);
  return merged;
}

describe('progress', () => {
  it('reports checks in batches as they land, not all at the end', async () => {
    const outcome = await scanOnce('good');
    const batches = batchesByMode.get('good') ?? [];

    // More than one batch is the whole point: one batch is the old behaviour,
    // where /scan/live showed "0 of 21" until the scan was over.
    expect(batches.length).toBeGreaterThan(1);
    // And every check reaches the sink exactly once, so a counter driven by it
    // arrives at the same number the result page shows.
    expect(batches.reduce((n, b) => n + b, 0)).toBe(outcome.results.length);
  });

  it('runs the same without a sink at all', async () => {
    fixture.setMode('robots-blocked');
    const outcome = await scan(`${fixture.origin}/`);
    expect(outcome.status).toBe('blocked');
  });
});
