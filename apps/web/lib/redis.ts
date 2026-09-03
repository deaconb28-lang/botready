/**
 * Upstash Redis: the per-IP rate limit and the 24 hour result cache.
 *
 * Both degrade rather than fail. If Redis is unreachable the rate limiter lets
 * the request through and the cache misses. That is the right direction for a
 * free diagnostic tool: an outage in the abuse control should not take the
 * product down, and the 6-pages-a-scan cap is a harder limit on the damage than
 * the rate limiter is anyway.
 */

import { Redis } from '@upstash/redis';

import { serverEnv } from './env';

let cached: Redis | null | undefined;

function client(): Redis | null {
  if (cached !== undefined) return cached;
  const url = serverEnv.redisUrl();
  const token = serverEnv.redisToken();
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}

/** True when Redis is configured. The rate limit is skipped when it is not. */
export function rateLimitingAvailable(): boolean {
  return client() !== null;
}

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window rolls over. */
  resetSeconds: number;
}

/**
 * A fixed window per hour, keyed on the caller. Fixed rather than sliding on
 * purpose: the limit is 5, the window is an hour, and a reader who understands
 * "five an hour" is better served than one who has to reason about a decaying
 * bucket. The reset is reported so the 429 can say when to come back.
 */
export async function rateLimit(key: string, limit: number): Promise<RateLimitVerdict> {
  const redis = client();
  if (!redis) {
    return { allowed: true, limit, remaining: limit, resetSeconds: 0 };
  }

  const windowSeconds = 3600;
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const redisKey = `ratelimit:${key}:${window}`;

  try {
    const used = await redis.incr(redisKey);
    if (used === 1) await redis.expire(redisKey, windowSeconds);

    const elapsed = Math.floor(Date.now() / 1000) % windowSeconds;
    return {
      allowed: used <= limit,
      limit,
      remaining: Math.max(0, limit - used),
      resetSeconds: windowSeconds - elapsed,
    };
  } catch {
    // Degrade open. See the note at the top of the file.
    return { allowed: true, limit, remaining: limit, resetSeconds: 0 };
  }
}

/**
 * The 24 hour result cache, keyed on the normalised domain.
 *
 * This is what stops a link from the public index being turned into a hammer:
 * the tenth person to click through to a domain in a day gets the ninth
 * person's scan, and the site being measured sees one crawl.
 */
export async function cachedScanId(domain: string): Promise<string | null> {
  const redis = client();
  if (!redis) return null;
  try {
    return (await redis.get<string>(`scan:${domain}`)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheScanId(domain: string, scanId: string, hours = 24): Promise<void> {
  const redis = client();
  if (!redis) return;
  try {
    await redis.set(`scan:${domain}`, scanId, { ex: hours * 3600 });
  } catch {
    // A cache that cannot be written is a cache miss next time. Nothing else.
  }
}

/** Drops the cache entry, so the next request crawls. Used by the cron jobs. */
export async function forgetCachedScan(domain: string): Promise<void> {
  const redis = client();
  if (!redis) return;
  try {
    await redis.del(`scan:${domain}`);
  } catch {
    // Nothing to do: the entry expires on its own within the day.
  }
}

/**
 * Once-only marker, used for Stripe webhook idempotency alongside the unique
 * index on entitlements.stripe_event_id. Two guards rather than one because
 * Stripe retries and the database constraint is the one that must hold, while
 * this one saves the work of getting there.
 */
export async function claimOnce(key: string, ttlSeconds = 86_400): Promise<boolean> {
  const redis = client();
  if (!redis) return true;
  try {
    const set = await redis.set(`once:${key}`, '1', { nx: true, ex: ttlSeconds });
    return set === 'OK';
  } catch {
    return true;
  }
}
