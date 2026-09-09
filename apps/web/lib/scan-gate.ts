/**
 * Whether to crawl. Pulled out of the route so the two production guard rails
 * can be tested without a database, a Redis or a request object.
 *
 * Three gates, in this order:
 *
 *   1. Has this domain been scanned in the last 24 hours? Hand back that scan.
 *      Many page views, one crawl.
 *   2. Is this caller inside their hourly allowance?
 *   3. Admit, and cache the new scan id the moment it is queued rather than
 *      when it finishes, so a burst of requests for one domain produces one
 *      crawl and not a crawl each.
 *
 * The cache comes before the limit deliberately: following a link from the
 * index costs the caller nothing, because it costs the site being measured
 * nothing.
 */

import { cacheScanId, cachedScanId, rateLimit, type RateLimitVerdict } from './redis';
import type { KV } from './kv';

export type Admission =
  | { kind: 'cached'; scanId: string }
  | { kind: 'limited'; verdict: RateLimitVerdict }
  | { kind: 'admit'; verdict: RateLimitVerdict };

export interface GateInput {
  domain: string;
  /** `ip:1.2.3.4` or `user:<id>`. */
  identity: string;
  limit: number;
  cacheHours: number;
  kv: KV | null;
  /** The most recent finished scan for the domain, from the database. */
  findRecent: (domain: string) => Promise<{ id: string; finishedAt: string } | null>;
  now?: number;
}

export async function admitScan(input: GateInput): Promise<Admission> {
  const now = input.now ?? Date.now();

  // 1. The cache, then the database behind it, because Redis may be cold.
  const cached = await cachedScanId(input.domain, input.kv);
  if (cached) return { kind: 'cached', scanId: cached };

  const recent = await input.findRecent(input.domain);
  if (recent && withinWindow(recent.finishedAt, input.cacheHours, now)) {
    await cacheScanId(input.domain, recent.id, input.cacheHours, input.kv);
    return { kind: 'cached', scanId: recent.id };
  }

  // 2. The allowance.
  const verdict = await rateLimit(input.identity, input.limit, input.kv, now);
  if (!verdict.allowed) return { kind: 'limited', verdict };

  // 3. Admit. The caller creates the scan and then calls `remember`.
  return { kind: 'admit', verdict };
}

/** Called once the scan row exists, before it is queued. */
export async function rememberScan(domain: string, scanId: string, cacheHours: number, kv: KV | null) {
  await cacheScanId(domain, scanId, cacheHours, kv);
}

function withinWindow(timestamp: string, hours: number, now: number): boolean {
  const age = now - new Date(timestamp).getTime();
  return Number.isFinite(age) && age >= 0 && age < hours * 3600 * 1000;
}

/**
 * The 429 body. Errors state what went wrong and what to do, and never
 * apologise. The minutes are rounded up so "resets in 1 minute" is never a lie.
 */
export function limitedMessage(verdict: RateLimitVerdict, signedIn: boolean, signedInLimit: number): string {
  const minutes = Math.max(1, Math.ceil(verdict.resetSeconds / 60));
  const when = `The allowance resets in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
  return signedIn
    ? `You have used all ${verdict.limit} scans in this hour. ${when}`
    : `You have used all ${verdict.limit} scans in this hour. ${when} Signing in raises it to ${signedInLimit}.`;
}

/**
 * How long a scan may *run* before we call it dead.
 *
 * Measured from `started_at`, and only for a scan that has actually started.
 * That distinction is the whole point of this constant now, and it was the bug
 * it exists to fix: this deadline used to be applied to queued scans too,
 * counting from creation, which meant a scan waiting behind others for its
 * turn was reported to the caller as a failed scan. Nothing was wrong with it
 * and nothing was wrong with the site.
 *
 * Twenty minutes rather than five. The five came with a comment saying the
 * slowest real scan on record took 90 seconds; the slowest that has actually
 * completed took 1,008 — sixteen minutes — which is the figure REAP_AFTER_MS
 * below was already set from. Two constants in one file disagreeing about the
 * same measurement is how a healthy scan gets called dead, so this one now
 * reads from the same number.
 */
export const STUCK_AFTER_MS = 20 * 60 * 1000;

/**
 * How long a scan may sit *queued* before something is genuinely wrong.
 *
 * The worker runs SCANNER_CONCURRENCY scans at a time (2 by default) and
 * queues the rest, so waiting is normal operation rather than a symptom. What
 * is not normal is waiting longer than the queue could plausibly be: at two at
 * a time and a minute each, an hour is thirty scans deep, which is far past
 * anything a single caller produces.
 *
 * Deliberately longer than the running deadline. A queued scan has consumed
 * nothing and is still going to run; a running scan whose worker restarted
 * never will.
 */
export const QUEUED_TOO_LONG_MS = 60 * 60 * 1000;

/**
 * How long the batch reaper waits before settling a scan, which is much
 * longer than STUCK_AFTER_MS and deliberately so.
 *
 * The two thresholds answer different questions. STUCK_AFTER_MS is asked by
 * the page somebody is watching, and being wrong there costs them a re-run of
 * something that was already dead. This one is asked by a cron about every
 * running scan on the platform at once, and being wrong here kills a scan that
 * was going to finish.
 *
 * Set from the data rather than from a round number: the slowest scan that
 * ever completed took 1,008 seconds — sixteen minutes — against a median of
 * 35. Thirty minutes clears that by nearly double and still settles a dead row
 * inside the hour.
 */
export const REAP_AFTER_MS = 30 * 60 * 1000;

/**
 * What a scan says when it stopped rather than finished.
 *
 * One string, because two code paths settle these — the page poll and the
 * cron — and a person who saw one message on screen and a different one in
 * their history would reasonably wonder which had happened.
 */
export const STOPPED_MESSAGE =
  'The scan stopped before it finished, which is our problem and not the site\'s. ' +
  'Some checks ran and the rest did not, so there is no score. Run it again.';

/**
 * Whether a scan has outlived any possible run.
 *
 * Nothing marks an orphaned scan as finished. The worker is the only thing
 * that would, and a worker that has been restarted is by definition not going
 * to. So the row sits at `running` forever and the live page polls it forever,
 * which is what a person experiences as "it has taken five minutes".
 *
 * Pure, so the ceiling is a test rather than a number somebody has to trust.
 */
export function isStuck(
  status: string,
  startedAt: string | null,
  createdAt: string,
  now: number = Date.now(),
): boolean {
  if (status !== 'running' && status !== 'queued') return false;

  // A scan that has not started cannot have died mid-run. It is waiting for a
  // worker slot, which is what the queue is for, and the only question worth
  // asking about it is whether the queue itself has stopped moving.
  if (status === 'queued' || !startedAt) {
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created)) return false;
    return now - created > QUEUED_TOO_LONG_MS;
  }

  const began = Date.parse(startedAt);
  if (!Number.isFinite(began)) return false;
  return now - began > STUCK_AFTER_MS;
}
