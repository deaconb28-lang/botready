/**
 * The published number is the number that acts.
 *
 * `points` in checks.json is a check's share within its category; what a
 * reader cares about is what failing it costs out of 100. Those were different
 * numbers on two pages of the same site — the weights page said
 * `agent_status_parity` was 18 points, the findings list said −13 — because
 * only two of the six categories have points that do not already sum to their
 * weight, so fifteen of the twenty-one checks agreed by coincidence.
 *
 * These tests are what stop them drifting apart again.
 */

import { describe, expect, it } from 'vitest';

import { catalog, categoryPoints, effectivePoints } from '../src/catalog';
import { pointsLost } from '../src/scoring';
import type { CheckResult } from '../src/types';

/** Every check failing, so every category has points in play. */
const ALL_FAIL: CheckResult[] = catalog.checks.map((c) => ({
  key: c.key,
  status: 'fail',
  observed: {},
  durationMs: 0,
}));

describe('effectivePoints', () => {
  it('agrees with what the findings list prints, for every check', () => {
    for (const check of catalog.checks) {
      expect(Math.round(effectivePoints(check.key)), check.key).toBe(pointsLost(ALL_FAIL, check.key));
    }
  });

  it('sums to 100 across the catalog', () => {
    const total = catalog.checks.reduce((sum, c) => sum + effectivePoints(c.key), 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("sums to each category's weight within that category", () => {
    for (const category of catalog.categories) {
      const sum = catalog.checks
        .filter((c) => c.category === category.key)
        .reduce((total, c) => total + effectivePoints(c.key), 0);
      expect(sum, category.key).toBeCloseTo(category.weight, 6);
    }
  });

  it('is the raw points only where a category already sums to its weight', () => {
    // Not a rule, an observation that explains why this went unnoticed: four of
    // the six categories happen to satisfy it, and their checks read correctly
    // on both pages.
    const coincidental = catalog.categories.filter((c) => categoryPoints(c.key) === c.weight);
    expect(coincidental.map((c) => c.key)).toEqual(['representation', 'structure', 'actionability', 'freshness']);

    for (const category of coincidental) {
      for (const check of catalog.checks.filter((c) => c.category === category.key)) {
        expect(effectivePoints(check.key), check.key).toBeCloseTo(check.points, 6);
      }
    }
  });

  it('returns zero for a key that is not in the catalog', () => {
    expect(effectivePoints('not_a_check')).toBe(0);
  });
});

describe('the catalog explains itself', () => {
  it('gives every check a rationale', () => {
    for (const check of catalog.checks) {
      expect(check.rationale?.length ?? 0, check.key).toBeGreaterThan(40);
    }
  });

  it('gives every category a rationale', () => {
    for (const category of catalog.categories) {
      expect(category.rationale?.length ?? 0, category.key).toBeGreaterThan(40);
    }
  });
});
