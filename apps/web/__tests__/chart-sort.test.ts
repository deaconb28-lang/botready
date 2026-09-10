/**
 * The chart, read in two orders.
 *
 * One assertion here matters more than the rest: sorting never renumbers. A
 * rank is a chart position earned by score, and reordering the list by when
 * each site was last checked must not hand the number one to whichever site
 * happened to be scanned last night. That would be a different number wearing
 * the same name, and the lime box would move with it.
 */

import { describe, expect, it } from 'vitest';

import {
  CHART_SORTS,
  DEFAULT_CHART_SORT,
  isChartSort,
  shortSince,
  since,
  sortChart,
  type ChartRow,
} from '../lib/chart-data';

const row = (over: Partial<ChartRow>): ChartRow => ({
  rank: 1,
  siteId: 's',
  scanId: 'x',
  domain: 'example.com',
  segment: null,
  isClaimed: false,
  status: 'complete',
  total: 70,
  grade: 'B',
  prevRank: null,
  peakTotal: 70,
  weeksOn: 1,
  description: null,
  iconCandidates: [],
  move: 'new',
  moveBy: 0,
  finishedAt: '2026-09-01T00:00:00Z',
  ...over,
});

const rows: ChartRow[] = [
  row({ siteId: 'a', domain: 'a.com', rank: 1, total: 92, finishedAt: '2026-08-01T00:00:00Z' }),
  row({ siteId: 'b', domain: 'b.com', rank: 2, total: 80, finishedAt: '2026-09-09T12:00:00Z' }),
  row({ siteId: 'c', domain: 'c.com', rank: 3, total: 71, finishedAt: '2026-09-01T00:00:00Z' }),
];

describe('sortChart', () => {
  it('puts the chart back in chart order', () => {
    expect(sortChart([...rows].reverse(), 'score').map((r) => r.domain)).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it('puts the newest scan first', () => {
    expect(sortChart(rows, 'recent').map((r) => r.domain)).toEqual(['b.com', 'c.com', 'a.com']);
  });

  it('never renumbers', () => {
    // The whole point. b.com was checked most recently and is still number 2.
    const recent = sortChart(rows, 'recent');
    expect(recent[0]?.domain).toBe('b.com');
    expect(recent[0]?.rank).toBe(2);
    expect(recent.map((r) => r.rank).sort()).toEqual([1, 2, 3]);
  });

  it('does not mutate what it was given', () => {
    const original = rows.map((r) => r.domain);
    sortChart(rows, 'recent');
    expect(rows.map((r) => r.domain)).toEqual(original);
  });

  it('sorts a site we have never finished checking last, not first', () => {
    // An absent date is not the beginning of time, which is where an empty
    // string would put it.
    const withNull = [...rows, row({ siteId: 'd', domain: 'd.com', rank: 4, finishedAt: null })];
    expect(sortChart(withNull, 'recent').map((r) => r.domain).at(-1)).toBe('d.com');
  });

  it('breaks a recency tie by rank rather than by name', () => {
    // The nightly sweep finishes many scans in the same second, and an
    // alphabetical tiebreak would shuffle the chart's own order for a reason
    // no reader could see.
    const same = [
      row({ siteId: 'z', domain: 'zeta.com', rank: 9, finishedAt: '2026-09-09T03:00:00Z' }),
      row({ siteId: 'a', domain: 'alpha.com', rank: 4, finishedAt: '2026-09-09T03:00:00Z' }),
    ];
    expect(sortChart(same, 'recent').map((r) => r.domain)).toEqual(['alpha.com', 'zeta.com']);
  });
});

describe('the sort parameter', () => {
  it('accepts only the orders that exist', () => {
    expect(isChartSort('score')).toBe(true);
    expect(isChartSort('recent')).toBe(true);
    expect(isChartSort('total')).toBe(false);
    expect(isChartSort(undefined)).toBe(false);
  });

  it('has a label and a hint for every order, and a default among them', () => {
    expect(CHART_SORTS.map((s) => s.key)).toContain(DEFAULT_CHART_SORT);
    for (const option of CHART_SORTS) {
      expect(option.label.length).toBeGreaterThan(2);
      expect(option.hint.length).toBeGreaterThan(30);
    }
  });
});

describe('how long ago', () => {
  const now = Date.parse('2026-09-09T12:00:00Z');

  it('reads in minutes, hours and days, and never in seconds', () => {
    expect(since('2026-09-09T11:40:00Z', now)).toBe('20 minutes ago');
    expect(since('2026-09-09T08:00:00Z', now)).toBe('4 hours ago');
    expect(since('2026-09-06T12:00:00Z', now)).toBe('3 days ago');
    expect(since('2026-09-09T11:59:50Z', now)).toBe('1 minute ago');
  });

  it('singularises', () => {
    expect(since('2026-09-09T11:00:00Z', now)).toBe('1 hour ago');
    expect(since('2026-09-08T12:00:00Z', now)).toBe('1 day ago');
  });

  it('has a short form for the mono column', () => {
    expect(shortSince('2026-09-09T11:40:00Z', now)).toBe('20m');
    expect(shortSince('2026-09-09T08:00:00Z', now)).toBe('4h');
    expect(shortSince('2026-09-06T12:00:00Z', now)).toBe('3d');
  });
});
