import { describe, expect, it } from 'vitest';

import { rank, type IndexRow } from '../lib/index-data';

type Unranked = Omit<IndexRow, 'rank'>;

function row(over: Partial<Unranked> & { domain: string }): Unranked {
  return {
    siteId: `site-${over.domain}`,
    segment: 'saas',
    isClaimed: false,
    scanId: `scan-${over.domain}`,
    status: 'complete',
    finishedAt: '2026-09-02T03:10:00Z',
    scoringVersion: '1.2',
    total: 70,
    grade: 'B',
    categoryScores: null,
    refused: { count: 0, of: 5 },
    jsRatio: 0.2,
    ...over,
  };
}

describe('rank', () => {
  it('orders by score, then fewer refusals, then lower JS dependency, then name', () => {
    const view = rank('saas', [
      row({ domain: 'c.com', total: 80 }),
      row({ domain: 'b.com', total: 80, refused: { count: 1, of: 5 } }),
      row({ domain: 'a.com', total: 80, jsRatio: 0.5 }),
      row({ domain: 'd.com', total: 94, grade: 'A' }),
    ]);
    expect(view.rows.map((r) => `${r.rank} ${r.domain}`)).toEqual([
      '1 d.com',
      '2 c.com', // 80, 0 refused, 0.2
      '3 a.com', // 80, 0 refused, 0.5
      '4 b.com', // 80, 1 refused
    ]);
  });

  it('lists blocked sites, labelled blocked, after everything with a score', () => {
    // Blocked sites appear in the table with no attempt to work around it.
    const view = rank('saas', [
      row({ domain: 'blocked.com', status: 'blocked', total: null, grade: null, refused: null, jsRatio: null }),
      row({ domain: 'low.com', total: 12, grade: 'F' }),
    ]);
    expect(view.rows.map((r) => r.domain)).toEqual(['low.com', 'blocked.com']);
    expect(view.rows[1]?.status).toBe('blocked');
    expect(view.blocked).toBe(1);
    expect(view.scored).toBe(1);
  });

  it('is stable between two renders of the same data', () => {
    const rows = [row({ domain: 'x.com' }), row({ domain: 'y.com' }), row({ domain: 'w.com' })];
    expect(rank('saas', rows).rows.map((r) => r.domain)).toEqual(rank('saas', [...rows].reverse()).rows.map((r) => r.domain));
  });

  it('reports the most recent check across the segment', () => {
    const view = rank('saas', [
      row({ domain: 'a.com', finishedAt: '2026-09-01T03:00:00Z' }),
      row({ domain: 'b.com', finishedAt: '2026-09-02T03:00:00Z' }),
      row({ domain: 'c.com', finishedAt: null }),
    ]);
    expect(view.lastCheckedAt).toBe('2026-09-02T03:00:00Z');
  });
});
