/**
 * When a scan is dead rather than slow.
 *
 * Nothing marks an orphaned scan as finished: the worker is the only thing
 * that would, and a worker that restarted mid-scan is by definition not coming
 * back to do it. The row sits at `running` and the live page polls it forever,
 * which is what a person experiences as "it has taken five minutes".
 */

import { describe, expect, it } from 'vitest';

import { QUEUED_TOO_LONG_MS, REAP_AFTER_MS, STOPPED_MESSAGE, STUCK_AFTER_MS, isStuck } from '../lib/scan-gate';

const NOW = Date.parse('2026-09-05T22:30:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('isStuck', () => {
  it('leaves a scan that is merely slow alone', () => {
    // The slowest scan that has actually completed took 1,008 seconds, which
    // is the figure both ceilings in scan-gate.ts are now set from. The 90
    // seconds this line used to cite is where the five-minute deadline came
    // from, and it was wrong by an order of magnitude.
    expect(isStuck('running', at(90_000), at(91_000), NOW)).toBe(false);
    expect(isStuck('running', at(1_008_000), at(1_009_000), NOW)).toBe(false);
    expect(isStuck('running', at(STUCK_AFTER_MS - 1), at(STUCK_AFTER_MS), NOW)).toBe(false);
  });

  it('calls a running scan dead once it has outlived any possible run', () => {
    expect(isStuck('running', at(STUCK_AFTER_MS + 1), at(STUCK_AFTER_MS + 2), NOW)).toBe(true);
  });

  it('measures a running scan from when it started, not from when it was asked for', () => {
    // The gap between the two is queue wait, and it is not the scan's fault.
    // A scan created half an hour ago that started ten seconds ago is ten
    // seconds old as far as this question is concerned.
    expect(isStuck('running', at(10_000), at(30 * 60_000), NOW)).toBe(false);
  });

  /**
   * The bug this group exists for.
   *
   * The worker runs SCANNER_CONCURRENCY scans at a time and queues the rest,
   * so a caller who submits several at once has some of them waiting — which
   * is the queue working. This deadline was being applied to those waiting
   * scans, counted from creation, so anything sitting behind a few others was
   * reported to the caller as a failed scan with "nothing was measured".
   *
   * Observed as 8 of 30 scans failing at client concurrency 4, 2 of 50 at
   * concurrency 2, and every one of them completing normally when re-run one
   * at a time. Nothing was wrong with those sites and nothing was wrong with
   * those scans.
   */
  describe('a queued scan is waiting, not dying', () => {
    it('is not stuck at ten minutes, which is a normal queue depth', () => {
      expect(isStuck('queued', null, at(10 * 60_000), NOW)).toBe(false);
    });

    it('is not stuck past the running deadline either', () => {
      expect(isStuck('queued', null, at(STUCK_AFTER_MS + 1), NOW)).toBe(false);
    });

    it('is still caught when the queue itself has stopped moving', () => {
      expect(isStuck('queued', null, at(QUEUED_TOO_LONG_MS + 1), NOW)).toBe(true);
    });

    it('gets the queued ceiling even if a started_at somehow exists', () => {
      // Status is the authority on whether it is running. A stale started_at
      // on a queued row must not resurrect the running deadline.
      expect(isStuck('queued', at(STUCK_AFTER_MS + 1), at(STUCK_AFTER_MS + 2), NOW)).toBe(false);
    });

    it('waits longer than a running scan does, never less', () => {
      expect(QUEUED_TOO_LONG_MS).toBeGreaterThan(STUCK_AFTER_MS);
    });
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

describe('the batch reaper waits much longer than the live page does', () => {
  // The two thresholds answer different questions. Being wrong on the page
  // costs somebody a re-run of a scan that was already dead. Being wrong in
  // the cron kills a scan that was going to finish, across every running scan
  // at once, so it gets the conservative number.
  it('is set well above the slowest scan that ever completed', () => {
    const slowestEverMs = 1_008 * 1000;
    expect(REAP_AFTER_MS).toBeGreaterThan(slowestEverMs);
  });

  it('is longer than the threshold the live page uses', () => {
    expect(REAP_AFTER_MS).toBeGreaterThan(STUCK_AFTER_MS);
  });

  it('still settles a dead scan inside an hour, which is the cron interval', () => {
    expect(REAP_AFTER_MS).toBeLessThan(60 * 60 * 1000);
  });

  it('does not claim nothing was measured, because a partial scan measured some of it', () => {
    // The message this replaced said "Nothing was measured". Every stuck scan
    // on record had between two and ten checks already written.
    expect(STOPPED_MESSAGE.toLowerCase()).not.toContain('nothing was measured');
    expect(STOPPED_MESSAGE).toContain('no score');
  });
});
