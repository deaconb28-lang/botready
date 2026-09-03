/**
 * Findings turn facts into sentences, so the thing worth testing is that every
 * sentence still contains the fact. A headline that says "poor AI readiness"
 * would pass a snapshot test and fail the product.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CHECK_KEYS, catalog } from '../src/catalog';
import { findings, passing } from '../src/findings';
import { score } from '../src/scoring';
import type { CheckResult } from '../src/types';

function fixture(name: string): CheckResult[] {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as CheckResult[];
}

describe('findings', () => {
  it('reports nothing when everything passes', () => {
    expect(findings(fixture('reference-a'))).toEqual([]);
  });

  it('reports every check when everything fails', () => {
    expect(findings(fixture('reference-f'))).toHaveLength(CHECK_KEYS.length);
  });

  it('leaves skips out, because there was nothing to measure', () => {
    const results = fixture('skips-and-errors');
    const keys = findings(results).map((f) => f.key);
    expect(keys).not.toContain('content_negotiation');
    expect(keys).not.toContain('cache_headers');
    // Errors are findings: the interface has to say the check could not run.
    expect(keys).toContain('agent_status_parity');
  });

  it('orders worst first, and the ordering matches the arithmetic', () => {
    const results = fixture('waf-blocked-spa');
    const list = findings(results);
    const lost = list.map((f) => f.pointsLost);
    expect([...lost].sort((a, b) => b - a)).toEqual(lost);
    expect(list[0]?.key).toBe('agent_status_parity');
  });

  it('accounts for the points the score actually lost', () => {
    // The page prints "these three account for 34 of the 59 points you lost",
    // so the finding attributions have to come from the same arithmetic as the
    // total or the sentence is wrong.
    const results = fixture('waf-blocked-spa');
    const total = score(results).total;
    const attributed = findings(results).reduce((sum, f) => sum + f.pointsLost, 0);
    // Rounding each finding independently costs a point or two against the
    // whole, which is expected and small. Anything larger means the two
    // calculations have drifted apart.
    expect(Math.abs(attributed - (100 - total))).toBeLessThanOrEqual(3);
  });

  it('carries the remedy key when the catalog names one', () => {
    const byKey = Object.fromEntries(findings(fixture('reference-f')).map((f) => [f.key, f]));
    for (const def of catalog.checks) {
      if (def.remedy) expect(byKey[def.key]?.remedy).toBe(def.remedy);
      else expect(byKey[def.key]?.remedy).toBeUndefined();
    }
  });
});

describe('every finding states what was measured', () => {
  const results = fixture('waf-blocked-spa');
  const list = findings(results);

  it.each(list.map((f) => [f.key, f] as const))('%s has a headline, a body and evidence', (_key, finding) => {
    expect(finding.headline.length).toBeGreaterThan(10);
    expect(finding.body.length).toBeGreaterThan(40);
    expect(finding.evidence.length).toBeGreaterThan(0);
  });

  it.each(list.map((f) => [f.key, f] as const))('%s never apologises', (_key, finding) => {
    // Errors state what went wrong and what to do, and never apologise.
    const text = `${finding.headline} ${finding.body}`;
    expect(text).not.toMatch(/\b(sorry|apolog|unfortunately|oops|whoops)\b/i);
  });

  /** Things that are capitalised because that is their name. */
  const PROPER_NOUNS = new Set([
    'JavaScript',
    'JSON-LD',
    'OpenGraph',
    'Googlebot',
    'Bingbot',
    'Accept',
    'Offer',
    'Last-Modified',
    'ETag',
    'HTTP',
    'Chrome',
    'ClaudeBot',
    'GPTBot',
    'PerplexityBot',
  ]);

  it.each(list.map((f) => [f.key, f] as const))(
    '%s is written in sentence case, not title case',
    (_key, finding) => {
      // A headline with Every Word Capitalised is the house style of the
      // products this one is positioned against.
      const words = finding.headline
        .split(/\s+/)
        .slice(1) // the first word is capitalised by definition
        .filter((w) => /^[A-Za-z][A-Za-z-]{3,}$/.test(w))
        .filter((w) => !PROPER_NOUNS.has(w));
      const capitalised = words.filter((w) => /^[A-Z]/.test(w));
      expect(capitalised, `${finding.headline} reads as title case`).toEqual([]);
    },
  );

  it('puts the measured numbers in the sentence', () => {
    const byKey = Object.fromEntries(list.map((f) => [f.key, f]));

    // 0.9662 -> 97%, and both character counts appear in the body.
    expect(byKey.js_dependency_ratio?.headline).toBe('97% of your page text needs JavaScript');
    expect(byKey.js_dependency_ratio?.body).toContain('312');
    expect(byKey.js_dependency_ratio?.body).toContain('9,240');
    expect(byKey.js_dependency_ratio?.evidence).toContain('JS dependency ratio: 0.97');

    // The parity headline counts the clients that actually disagreed.
    expect(byKey.agent_status_parity?.headline).toBe('Four agent clients are refused at the edge');
    expect(byKey.agent_status_parity?.body).toContain('403');
    expect(byKey.agent_status_parity?.evidence).toContain('cf-mitigated: challenge');
  });

  it('says a check could not run rather than implying the site failed it', () => {
    const errored = findings(fixture('skips-and-errors')).find(
      (f) => f.key === 'agent_status_parity',
    );
    expect(errored?.status).toBe('error');
    expect(errored?.headline).toMatch(/could not measure/i);
    expect(errored?.body).toMatch(/Nothing on your site is implied/i);
  });
});

describe('passing', () => {
  it('lists everything that passed, in catalog order', () => {
    const list = passing(fixture('reference-a'));
    expect(list.map((f) => f.key)).toEqual([...CHECK_KEYS]);
    expect(list.every((f) => f.pointsLost === 0)).toBe(true);
  });

  it('lists nothing when nothing passed', () => {
    expect(passing(fixture('reference-f'))).toEqual([]);
  });
});
