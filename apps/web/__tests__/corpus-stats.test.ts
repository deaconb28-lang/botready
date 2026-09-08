import { describe, expect, it } from 'vitest';

import { corpusStats, oneInPhrase } from '../lib/corpus-stats';
import type { IndexRow } from '../lib/index-data';

function row(over: Partial<IndexRow>): IndexRow {
  return {
    siteId: 's', domain: 'example.com', segment: 'saas', isClaimed: false,
    scanId: 'x', status: 'complete', finishedAt: null, scoringVersion: '1.2',
    total: 70, grade: 'C', categoryScores: null, refused: null, jsRatio: null,
    previousTotal: null, rank: 1,
    ...over,
  };
}

describe('corpusStats', () => {
  it('averages only the sites that produced a score', () => {
    // A refused site has no score. Counting it as a zero would drag the average
    // down with a number nobody measured.
    const stats = corpusStats([
      row({ total: 80, grade: 'A' }),
      row({ total: 60, grade: 'D' }),
      row({ total: null, grade: null, status: 'blocked' }),
    ]);
    expect(stats.sites).toBe(3);
    expect(stats.scored).toBe(2);
    expect(stats.averageScore).toBe(70);
  });

  it('counts D and F as poor, and leaves C out of it', () => {
    // gradeIsHealthy() treats C as unhealthy, which is right for a grade tile
    // and wrong here: the claim on the page is "D or worse".
    const stats = corpusStats([
      row({ grade: 'C' }), row({ grade: 'D' }), row({ grade: 'F' }), row({ grade: 'B' }),
    ]);
    expect(stats.poor).toBe(2);
  });

  it('counts a refusal as a status rather than a low score', () => {
    const stats = corpusStats([
      row({ status: 'blocked', total: null, grade: null }),
      row({ status: 'complete' }),
    ]);
    expect(stats.refused).toBe(1);
    expect(stats.poor).toBe(0);
  });

  it('reports nothing rather than zero when the corpus is empty', () => {
    expect(corpusStats([])).toEqual({
      sites: 0, scored: 0, averageScore: null, poor: 0, refused: 0,
    });
  });
});

describe('oneInPhrase', () => {
  it('rounds to a small denominator', () => {
    expect(oneInPhrase(37, 149)).toBe('1 in 4');
    expect(oneInPhrase(50, 100)).toBe('1 in 2');
  });

  it('declines when the ratio would mislead at that rounding', () => {
    // Everything, nothing, and a tail so long the phrase stops being useful.
    expect(oneInPhrase(0, 149)).toBeNull();
    expect(oneInPhrase(149, 149)).toBeNull();
    expect(oneInPhrase(1, 500)).toBeNull();
  });
});
