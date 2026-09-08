/**
 * The two places the dashboard reshapes rows rather than reading them.
 *
 * Everything else in lib/admin-metrics.ts is a query, and a query is tested by
 * running it. These two have rules in them, and both rules are the kind that
 * fail quietly: a missing day makes a quiet week look like a busy one with
 * fewer bars, and a trigger folded wrong makes our own cron look like demand.
 */

import { describe, expect, it } from 'vitest';

import { byDay, byTrigger } from '../lib/admin-metrics';

const today = new Date().toISOString().slice(0, 10);

describe('thirty days of scans', () => {
  it('always returns thirty buckets, oldest first', () => {
    const out = byDay([]);
    expect(out).toHaveLength(30);
    expect(out[29]?.day).toBe(today);
    expect(new Date(out[0]!.day).getTime()).toBeLessThan(new Date(out[29]!.day).getTime());
  });

  it('keeps the empty days, because a quiet day is a fact about the day', () => {
    const out = byDay([{ day: today, total: 9, complete: 9, blocked: 0, errored: 0 }]);
    expect(out).toHaveLength(30);
    expect(out.filter((d) => d.total === 0)).toHaveLength(29);
  });

  it('carries the outcome split through', () => {
    const out = byDay([{ day: today, total: 10, complete: 7, blocked: 2, errored: 1 }]);
    const last = out[29]!;
    expect(last).toMatchObject({ total: 10, complete: 7, blocked: 2, errored: 1 });
  });

  it('reads a full timestamp as its date', () => {
    const out = byDay([{ day: `${today}T14:00:00Z`, total: 4, complete: 4, blocked: 0, errored: 0 }]);
    expect(out[29]?.total).toBe(4);
  });

  it('treats a day it has never heard of as zero rather than as missing', () => {
    const out = byDay([{ day: '2001-01-01', total: 99, complete: 99, blocked: 0, errored: 0 }]);
    expect(out).toHaveLength(30);
    expect(out.every((d) => d.total === 0)).toBe(true);
  });
});

describe('where scans come from', () => {
  const rows = [
    { trigger: 'manual', status: 'complete', count: 150 },
    { trigger: 'manual', status: 'error', count: 21 },
    { trigger: 'manual', status: 'blocked', count: 11 },
    { trigger: 'manual', status: 'queued', count: 1 },
    { trigger: 'index', status: 'complete', count: 66 },
  ];

  it('folds every status of one trigger into one row', () => {
    const out = byTrigger(rows);
    expect(out.map((t) => t.trigger)).toEqual(['manual', 'index']);
    expect(out[0]).toMatchObject({ trigger: 'manual', total: 183, complete: 150, failed: 32 });
  });

  it('counts a refusal as a failed scan, because it produced no score', () => {
    const out = byTrigger([{ trigger: 'manual', status: 'blocked', count: 4 }]);
    expect(out[0]?.failed).toBe(4);
  });

  it('does not count a queued scan as either', () => {
    const out = byTrigger([{ trigger: 'manual', status: 'queued', count: 3 }]);
    expect(out[0]).toMatchObject({ total: 3, complete: 0, failed: 0 });
  });

  it('orders by volume, so the biggest source is the first thing read', () => {
    const out = byTrigger(rows);
    expect(out[0]!.total).toBeGreaterThan(out[1]!.total);
  });

  it('returns nothing for nothing', () => {
    expect(byTrigger([])).toEqual([]);
  });
});
