/**
 * Scoring, against five hand-labelled fixtures.
 *
 * Every expected total below is written out as arithmetic, not copied from a
 * previous run, and asserted exactly rather than as a range. That is the whole
 * point: the weights are published on the site, so if a change to the scoring
 * function moves a total by one point, somebody has to have decided that.
 *
 * The catalog's points per category, which every sum below uses:
 *
 *   retrievability  25%   parity 18 + js 11 + latency 3 + redirects 3   = 35
 *   discovery       20%   robots 4 + agent rules 8 + sitemap 4 + llms 5 = 21
 *   representation  20%   markdown 7 + landmarks 6 + titles 4 + accept 3 = 20
 *   structure       15%   jsonld 6 + pricing 5 + canonical 4            = 15
 *   actionability   15%   manifest 5 + docs 4 + forms 4 + wall 2        = 15
 *   freshness        5%   cache 3 + lastmod 2                           = 5
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CATEGORY_KEYS, CHECK_KEYS, catalog, categoryPoints } from '../src/catalog';
import { WARN_CREDIT, gradeFor, pointsLost, score, scoreDetail } from '../src/scoring';
import type { CheckResult } from '../src/types';

function fixture(name: string): CheckResult[] {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as CheckResult[];
}

describe('the catalog the fixtures are scored against', () => {
  it('has the weights the arithmetic in this file assumes', () => {
    expect(Object.fromEntries(catalog.categories.map((c) => [c.key, c.weight]))).toEqual({
      retrievability: 25,
      discovery: 20,
      representation: 20,
      structure: 15,
      actionability: 15,
      freshness: 5,
    });
    expect(catalog.categories.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });

  it('has the points per category the arithmetic assumes', () => {
    expect(Object.fromEntries(CATEGORY_KEYS.map((k) => [k, categoryPoints(k)]))).toEqual({
      retrievability: 35,
      discovery: 21,
      representation: 20,
      structure: 15,
      actionability: 15,
      freshness: 5,
    });
  });

  it('gives amber half credit, which every warn below depends on', () => {
    expect(WARN_CREDIT).toBe(0.5);
  });

  it('has no duplicate keys and no check outside the six categories', () => {
    expect(new Set(CHECK_KEYS).size).toBe(CHECK_KEYS.length);
    for (const check of catalog.checks) {
      expect(CATEGORY_KEYS, `${check.key} is in category ${check.category}`).toContain(
        check.category,
      );
    }
  });
});

describe('reference-a: every check passes', () => {
  it('scores 100 and grades A', () => {
    // Every category earns everything available, so every subscore is 100 and
    // the weighted total is 100 whatever the weights are.
    const result = score(fixture('reference-a'));
    expect(result.total).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.categoryScores).toEqual({
      retrievability: 100,
      discovery: 100,
      representation: 100,
      structure: 100,
      actionability: 100,
      freshness: 100,
    });
    expect(result.failedChecks).toEqual([]);
    expect(result.erroredChecks).toEqual([]);
    expect(result.skippedChecks).toEqual([]);
  });
});

describe('reference-f: every check fails', () => {
  it('scores 0 and grades F', () => {
    const result = score(fixture('reference-f'));
    expect(result.total).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.categoryScores).toEqual({
      retrievability: 0,
      discovery: 0,
      representation: 0,
      structure: 0,
      actionability: 0,
      freshness: 0,
    });
    // Every key in the catalog, in catalog order.
    expect(result.failedChecks).toEqual([...CHECK_KEYS]);
    expect(result.skippedChecks).toEqual([]);
  });
});

describe('waf-blocked-spa: the archetype the product exists for', () => {
  it('scores 50 and grades D', () => {
    // retrievability  0 + 0 + 3 + 3           =  6 / 35 = 17.142857
    // discovery       4 + 8 + 4 + 0           = 16 / 21 = 76.190476
    // representation  0 + 6 + 2 + 1.5         =  9.5/ 20 = 47.5
    // structure       6 + 0 + 4               = 10 / 15 = 66.666667
    // actionability   0 + 4 + 2 + 2           =  8 / 15 = 53.333333
    // freshness       3 + 0                   =  3 /  5 = 60
    //
    // total = (25(17.142857) + 20(76.190476) + 20(47.5)
    //          + 15(66.666667) + 15(53.333333) + 5(60)) / 100
    //       = (428.5714 + 1523.8095 + 950 + 1000 + 800 + 300) / 100
    //       = 5002.3809 / 100
    //       = 50.0238  ->  50
    const result = score(fixture('waf-blocked-spa'));
    expect(result.total).toBe(50);
    expect(result.grade).toBe('D');
    expect(result.categoryScores).toEqual({
      retrievability: 17,
      discovery: 76,
      representation: 48, // 47.5 rounds away from zero
      structure: 67,
      actionability: 53,
      freshness: 60,
    });
    expect(result.failedChecks).toEqual([
      'agent_status_parity',
      'js_dependency_ratio',
      'llms_txt_present',
      'markdown_alternate',
      'pricing_structured',
      'agent_manifest',
      'sitemap_lastmod_real',
    ]);
  });

  it('attributes the points lost to the checks that lost them', () => {
    const results = fixture('waf-blocked-spa');
    // The parity check is 18 of the 35 points in a category weighted 25, so
    // failing it costs 18/35 * 25 = 12.857 -> 13 points of the total.
    expect(pointsLost(results, 'agent_status_parity')).toBe(13);
    // The ratio is 11 of 35 in the same category: 11/35 * 25 = 7.857 -> 8.
    expect(pointsLost(results, 'js_dependency_ratio')).toBe(8);
    // A warn only loses half: titles are 4 of 20 in a category weighted 20,
    // so 2/20 * 20 = 2.
    expect(pointsLost(results, 'title_meta_distinct')).toBe(2);
    // A pass loses nothing.
    expect(pointsLost(results, 'semantic_landmarks')).toBe(0);
  });
});

describe('skips-and-errors: the two statuses that are not failures', () => {
  it('scores 78 and grades B', () => {
    // An error scores as a fail but stays in the denominator, so the two
    // errored retrievability checks cost their points:
    //   retrievability  0 + 0 + 3 + 3 =  6 / 35 = 17.142857
    //
    // A skip leaves the denominator entirely, so a category where the rest
    // passed is 100 rather than a fraction:
    //   discovery       21 / 21                    = 100
    //   representation  17 / (20 - 3 skipped)      = 100
    //   structure       10 / (15 - 5 skipped)      = 100
    //   actionability    9 / (15 - 4 - 2 skipped)  = 100
    //
    // Freshness was skipped entirely, so its 5% is redistributed rather than
    // counted as zero, which means the denominator is 95 and not 100:
    //   total = (25(17.142857) + 20(100) + 20(100) + 15(100) + 15(100)) / 95
    //         = (428.5714 + 2000 + 2000 + 1500 + 1500) / 95
    //         = 7428.5714 / 95
    //         = 78.1955  ->  78
    const result = score(fixture('skips-and-errors'));
    expect(result.total).toBe(78);
    expect(result.grade).toBe('B');
    expect(result.categoryScores).toEqual({
      retrievability: 17,
      discovery: 100,
      representation: 100,
      structure: 100,
      actionability: 100,
      freshness: 0, // nothing was measured; the weight moved rather than the score
    });
  });

  it('lists the errored checks apart from the failed ones', () => {
    // So the interface can say the check could not run rather than implying the
    // site failed it.
    const result = score(fixture('skips-and-errors'));
    expect(result.erroredChecks).toEqual(['agent_status_parity', 'js_dependency_ratio']);
    expect(result.failedChecks).toEqual([]);
    expect(result.skippedChecks).toEqual([
      'content_negotiation',
      'pricing_structured',
      'form_semantics',
      'no_wall_on_docs',
      'cache_headers',
      'sitemap_lastmod_real',
    ]);
  });

  it('removes a skip from the denominator rather than counting it as zero', () => {
    const detail = scoreDetail(fixture('skips-and-errors'));
    const representation = detail.categories.find((c) => c.key === 'representation');
    expect(representation?.available).toBe(17); // 20 minus the 3 skipped points
    expect(representation?.earned).toBe(17);

    const freshness = detail.categories.find((c) => c.key === 'freshness');
    expect(freshness?.available).toBe(0);
  });
});

describe('retrievable-but-undescribed: retrievability passes, everything else warns', () => {
  it('scores 63 and grades C', () => {
    // retrievability  35 / 35            = 100
    // every other     half of everything =  50
    //
    // total = (25(100) + 20(50) + 20(50) + 15(50) + 15(50) + 5(50)) / 100
    //       = (2500 + 1000 + 1000 + 750 + 750 + 250) / 100
    //       = 6250 / 100
    //       = 62.5  ->  63
    const result = score(fixture('retrievable-but-undescribed'));
    expect(result.total).toBe(63);
    expect(result.grade).toBe('C');
    expect(result.categoryScores).toEqual({
      retrievability: 100,
      discovery: 50,
      representation: 50,
      structure: 50,
      actionability: 50,
      freshness: 50,
    });
    expect(result.failedChecks).toEqual([]);
  });
});

describe('the grade bands', () => {
  it.each([
    [100, 'A'],
    [85, 'A'],
    [84, 'B'],
    [70, 'B'],
    [69, 'C'],
    [55, 'C'],
    [54, 'D'],
    [35, 'D'],
    [34, 'F'],
    [0, 'F'],
  ])('grades %i as %s', (total, grade) => {
    expect(gradeFor(total)).toBe(grade);
  });
});

describe('purity', () => {
  it('produces the same answer every time', () => {
    const results = fixture('waf-blocked-spa');
    const first = score(results);
    const second = score(results);
    expect(second).toEqual(first);
  });

  it('does not mutate what it is given', () => {
    const results = fixture('waf-blocked-spa');
    const before = JSON.stringify(results);
    score(results);
    expect(JSON.stringify(results)).toBe(before);
  });

  it('is not sensitive to the order the worker emitted checks in', () => {
    const results = fixture('waf-blocked-spa');
    const shuffled = [...results].reverse();
    expect(score(shuffled).total).toBe(score(results).total);
    // And the lists come back in catalog order either way, so a scan's
    // findings do not reshuffle between two reads of the same evidence.
    expect(score(shuffled).failedChecks).toEqual(score(results).failedChecks);
  });

  it('reproduces the total exactly after a round trip through jsonb', () => {
    // The re-score path: `evidence` rows come back from Postgres as parsed
    // JSON, which is a different object graph with the same content. If the
    // total moved here, re-scoring history after a weight change would silently
    // rewrite every number on the site.
    const results = fixture('waf-blocked-spa');
    const stored = score(results);

    const roundTripped = (JSON.parse(JSON.stringify(results)) as CheckResult[]).map((row) => ({
      key: row.key,
      status: row.status,
      observed: row.observed,
      durationMs: row.durationMs,
    }));

    const rescored = score(roundTripped, stored.scoringVersion);
    expect(rescored.total).toBe(stored.total);
    expect(rescored).toEqual(stored);
  });

  it('ignores a stray row for a check the catalog no longer carries', () => {
    // A retired check leaves rows behind. They must not enter the arithmetic,
    // and reading one must not throw: the whole point of separating evidence
    // from scoring is that old evidence stays readable.
    const results = fixture('reference-a');
    const withGhost: CheckResult[] = [
      ...results,
      { key: 'a_check_we_retired', status: 'fail', observed: {}, durationMs: 12 },
    ];
    expect(score(withGhost).total).toBe(score(results).total);
  });

  it('scores an empty evidence set as zero rather than dividing by zero', () => {
    const result = score([]);
    expect(result.total).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.skippedChecks).toEqual([...CHECK_KEYS]);
  });

  it('stamps the catalog version when none is asked for', () => {
    expect(score(fixture('reference-a')).scoringVersion).toBe(catalog.scoringVersion);
  });

  it('refuses a version it has no catalog for, rather than guessing', () => {
    expect(() => score(fixture('reference-a'), '0.9')).toThrow(/No catalog for scoring version 0.9/);
  });
});

describe('the fixtures themselves', () => {
  it.each([
    'reference-a',
    'reference-f',
    'waf-blocked-spa',
    'skips-and-errors',
    'retrievable-but-undescribed',
  ])('%s carries exactly one row per catalog check, all with known keys', (name) => {
    const results = fixture(name);
    expect(results).toHaveLength(CHECK_KEYS.length);
    expect(results.map((r) => r.key).sort()).toEqual([...CHECK_KEYS].sort());
  });

  it.each(['reference-a', 'reference-f', 'waf-blocked-spa'])(
    '%s holds facts in observed and no judgement',
    (name) => {
      const forbidden = /\b(points?|score|grade|weight|penalt|blocked)\b/i;
      for (const row of fixture(name)) {
        for (const key of Object.keys(row.observed)) {
          expect(key, `${row.key}.observed.${key} reads like a judgement`).not.toMatch(forbidden);
        }
      }
    },
  );
});
