/**
 * The per-IP rate limit, the 24 hour result cache, and the once-marker.
 *
 * All three take a KV so they can be exercised against memory. All three
 * degrade open when the KV is absent or throws; see lib/kv.ts for why.
 */

import { defaultKV, type KV } from './kv';

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window rolls over. */
  resetSeconds: number;
}

const WINDOW_SECONDS = 3600;

/**
 * A fixed window per hour, keyed on the caller. Fixed rather than sliding on
 * purpose: the limit is five, the window is an hour, and a reader who
 * understands "five an hour" is better served than one who has to reason about
 * a decaying bucket. The reset is reported so the 429 can say when to return.
 */
export async function rateLimit(
  identity: string,
  limit: number,
  kv: KV | null = defaultKV(),
  now: number = Date.now(),
): Promise<RateLimitVerdict> {
  const open = { allowed: true, limit, remaining: limit, resetSeconds: 0 };
  if (!kv) return open;

  const seconds = Math.floor(now / 1000);
  const window = Math.floor(seconds / WINDOW_SECONDS);
  const key = `ratelimit:${identity}:${window}`;

  try {
    const used = await kv.incr(key);
    if (used === 1) await kv.expire(key, WINDOW_SECONDS);
    return {
      allowed: used <= limit,
      limit,
      remaining: Math.max(0, limit - used),
      resetSeconds: WINDOW_SECONDS - (seconds % WINDOW_SECONDS),
    };
  } catch {
    return open;
  }
}

/**
 * The 24 hour result cache, keyed on the normalised domain.
 *
 * This is what stops a link from the public index being turned into a hammer:
 * the tenth person to click through to a domain in a day gets the ninth
 * person's scan, and the site being measured sees one crawl.
 */
export async function cachedScanId(domain: string, kv: KV | null = defaultKV()): Promise<string | null> {
  if (!kv) return null;
  try {
    return await kv.get(`scan:${domain}`);
  } catch {
    return null;
  }
}

export async function cacheScanId(
  domain: string,
  scanId: string,
  hours = 24,
  kv: KV | null = defaultKV(),
): Promise<void> {
  if (!kv) return;
  try {
    await kv.set(`scan:${domain}`, scanId, { ex: hours * 3600 });
  } catch {
    // A cache that cannot be written is a cache miss next time. Nothing else.
  }
}

/** Drops the entry, so the next request crawls. The cron jobs use it. */
export async function forgetCachedScan(domain: string, kv: KV | null = defaultKV()): Promise<void> {
  if (!kv) return;
  try {
    await kv.del(`scan:${domain}`);
  } catch {
    // The entry expires on its own within the day.
  }
}

/**
 * Once-only marker. The Stripe webhook uses it as the fast path for a replay;
 * the unique index on entitlements.stripe_event_id is the guard that must hold,
 * so this one is allowed to fail open.
 */
export async function claimOnce(
  key: string,
  ttlSeconds = 86_400,
  kv: KV | null = defaultKV(),
): Promise<boolean> {
  if (!kv) return true;
  try {
    return await kv.set(`once:${key}`, '1', { nx: true, ex: ttlSeconds });
  } catch {
    return true;
  }
}

export function rateLimitingAvailable(): boolean {
  return defaultKV() !== null;
}
