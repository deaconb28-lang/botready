/**
 * The four Redis commands the product uses, behind an interface, so the rate
 * limit and the cache can be tested against memory and run against Upstash.
 *
 * Upstash is reached over HTTP and the client degrades open when it is not
 * configured: no limit, no cache. That is the right direction for a free
 * diagnostic tool — an outage in the abuse control should not take the product
 * down — and the six-page cap on every scan is a harder ceiling on the damage
 * than the rate limiter is anyway.
 */

import { serverEnv } from './env';

export interface KV {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Returns false when `nx` was set and the key already existed. */
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
}

/** In memory, with expiry, for tests and for a laptop with no Upstash. */
export function memoryKV(clock: () => number = Date.now): KV {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  const live = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= clock()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    async incr(key) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async expire(key, seconds) {
      const entry = live(key);
      if (entry) entry.expiresAt = clock() + seconds * 1000;
    },
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, opts) {
      if (opts?.nx && live(key)) return false;
      store.set(key, { value, expiresAt: opts?.ex ? clock() + opts.ex * 1000 : null });
      return true;
    },
    async del(key) {
      store.delete(key);
    },
  };
}

let upstash: KV | null | undefined;

/** Upstash, or null when it is not configured. */
export function upstashKV(): KV | null {
  if (upstash !== undefined) return upstash;

  const url = serverEnv.redisUrl();
  const token = serverEnv.redisToken();
  if (!url || !token) {
    upstash = null;
    return null;
  }

  // Imported lazily so a missing package or key never breaks a build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  const redis = new Redis({ url, token });

  upstash = {
    incr: (key) => redis.incr(key),
    expire: async (key, seconds) => {
      await redis.expire(key, seconds);
    },
    get: async (key) => (await redis.get<string>(key)) ?? null,
    set: async (key, value, opts) => {
      // Upstash types the options as a union of exact shapes, so each
      // combination is spelled out rather than spread.
      const result =
        opts?.ex && opts.nx
          ? await redis.set(key, value, { ex: opts.ex, nx: true })
          : opts?.ex
            ? await redis.set(key, value, { ex: opts.ex })
            : opts?.nx
              ? await redis.set(key, value, { nx: true })
              : await redis.set(key, value);
      return result === 'OK';
    },
    del: async (key) => {
      await redis.del(key);
    },
  };
  return upstash;
}

/** The store the app actually uses: Upstash when configured, otherwise nothing. */
export function defaultKV(): KV | null {
  return upstashKV();
}
