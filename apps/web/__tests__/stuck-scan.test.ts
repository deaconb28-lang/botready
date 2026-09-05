/**
 * When a scan is dead rather than slow.
 *
 * Nothing marks an orphaned scan as finished: the worker is the only thing
 * that would, and a worker that restarted mid-scan is by definition not coming
 * back to do it. The row sits at `running` and the live page polls it forever,
 * which is what a person experiences as "it has taken five minutes".
 */

import { describe, expect, it } from 'vitest';

import { STUCK_AFTER_MS, isStuck } from '../lib/scan-gate';

const NOW = Date.parse('2026-09-05T22:30:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('isStuck', () => {
  it('leaves a scan that is merely slow alone', () => {
    // The slowest real scan on record finished in 90 seconds.
    expect(isStuck('running', at(90_000), at(91_000), NOW)).toBe(false);
    expect(isStuck('running', at(STUCK_AFTER_MS - 1), at(STUCK_AFTER_MS), NOW)).toBe(false);
  });

  it('calls a scan dead once it has outlived any possible run', () => {
    expect(isStuck('running', at(STUCK_AFTER_MS + 1), at(STUCK_AFTER_MS + 2), NOW)).toBe(true);
    expect(isStuck('queued', at(10 * 60_000), at(10 * 60_000), NOW)).toBe(true);
  });

  it('measures from creation when the worker never started it', () => {
    // Queued and never picked up: QStash dropped it, or the worker was down.
    expect(isStuck('queued', null, at(STUCK_AFTER_MS + 1), NOW)).toBe(true);
    expect(isStuck('queued', null, at(1000), NOW)).toBe(false);
  });

  it('never touches a scan that already settled', () => {
    for (const status of ['complete', 'blocked', 'error']) {
      expect(isStuck(status, at(60 * 60_000), at(60 * 60_000), NOW), status).toBe(false);
    }
  });

  it('does nothing with an unparseable timestamp rather than guessing', () => {
    expect(isStuck('running', 'not a date', 'nor this', NOW)).toBe(false);
  });
});
