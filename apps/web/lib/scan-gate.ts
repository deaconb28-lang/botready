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
 * How long a scan may run before we call it dead.
 *
 * Six pages a second apart, five clients, and a headless render: the slowest
 * real scan on record finished in 90 seconds. Five minutes is far outside
 * that, so anything past it is not slow, it is gone — almost always a worker
 * that restarted mid-scan and took the run with it.
 */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

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
  const began = Date.parse(startedAt ?? createdAt);
  if (!Number.isFinite(began)) return false;
  return now - began > STUCK_AFTER_MS;
}
