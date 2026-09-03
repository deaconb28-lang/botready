/**
 * The two production guard rails, as M7 states them:
 *
 *   the 6th anonymous scan in an hour returns 429 with a plain explanation
 *   two scans of the same domain within 24 hours produce one crawl
 *
 * Run against the in-memory KV and a counter standing in for the crawler, so
 * "one crawl" is a number this test can read rather than a log line to grep.
 */

import { describe, expect, it } from 'vitest';

import { memoryKV } from '../lib/kv';
import { claimOnce, rateLimit } from '../lib/redis';
import { admitScan, limitedMessage, rememberScan } from '../lib/scan-gate';

const HOUR = 3600 * 1000;

/**
 * A caller, with a crawler behind it that counts. `scan()` is what the route
 * does: ask the gate, and crawl only on `admit`.
 */
function harness(opts: { limit: number; now?: number } ) {
  const kv = memoryKV(() => state.now);
  const state = { now: opts.now ?? Date.UTC(2026, 8, 2, 14, 0, 0), crawls: 0, next: 1 };
  const finished = new Map<string, { id: string; finishedAt: string }>();

  async function scan(domain: string, identity = 'ip:203.0.113.5') {
    const admission = await admitScan({
      domain,
      identity,
      limit: opts.limit,
      cacheHours: 24,
      kv,
      findRecent: async (d) => finished.get(d) ?? null,
      now: state.now,
    });
    if (admission.kind !== 'admit') return admission;

    const scanId = `scan-${state.next++}`;
    state.crawls += 1;
    await rememberScan(domain, scanId, 24, kv);
    finished.set(domain, { id: scanId, finishedAt: new Date(state.now).toISOString() });
    return { kind: 'admit' as const, scanId, verdict: admission.verdict };
  }

  return { scan, state, kv, finished };
}

describe('the hourly allowance', () => {
  it('admits five anonymous scans and refuses the sixth with a plain explanation', async () => {
    const h = harness({ limit: 5 });

    for (let i = 1; i <= 5; i += 1) {
      const result = await h.scan(`site-${i}.example`);
      expect(result.kind, `scan ${i} should be admitted`).toBe('admit');
    }

    const sixth = await h.scan('site-6.example');
    expect(sixth.kind).toBe('limited');
    if (sixth.kind !== 'limited') throw new Error('unreachable');

    const message = limitedMessage(sixth.verdict, false, 50);
    expect(message).toMatch(/^You have used all 5 scans in this hour\./);
    expect(message).toMatch(/resets in \d+ minutes?\./);
    expect(message).toMatch(/Signing in raises it to 50\./);
    expect(message).not.toMatch(/sorry|apolog/i);
    expect(sixth.verdict.resetSeconds).toBeGreaterThan(0);
    expect(sixth.verdict.resetSeconds).toBeLessThanOrEqual(3600);

    expect(h.state.crawls).toBe(5);
  });

  it('gives a signed-in caller the larger allowance and a shorter message', async () => {
    const h = harness({ limit: 50 });
    for (let i = 1; i <= 50; i += 1) {
      expect((await h.scan(`s${i}.example`, 'user:abc')).kind).toBe('admit');
    }
    const over = await h.scan('s51.example', 'user:abc');
    expect(over.kind).toBe('limited');
    if (over.kind !== 'limited') throw new Error('unreachable');
    expect(limitedMessage(over.verdict, true, 50)).not.toMatch(/Signing in/);
  });

  it('keeps callers apart', async () => {
    const h = harness({ limit: 5 });
    for (let i = 1; i <= 5; i += 1) await h.scan(`a${i}.example`, 'ip:1.1.1.1');
    expect((await h.scan('a6.example', 'ip:1.1.1.1')).kind).toBe('limited');
    expect((await h.scan('b1.example', 'ip:2.2.2.2')).kind).toBe('admit');
  });

  it('rolls over on the hour', async () => {
    const h = harness({ limit: 5 });
    for (let i = 1; i <= 5; i += 1) await h.scan(`a${i}.example`);
    expect((await h.scan('a6.example')).kind).toBe('limited');

    h.state.now += HOUR;
    expect((await h.scan('a7.example')).kind).toBe('admit');
  });

  it('reports the reset as the time left in the window, not a full hour', async () => {
    // 14:00 exactly, so the window has an hour left; at 14:45 it has fifteen.
    const kv = memoryKV(() => now);
    let now = Date.UTC(2026, 8, 2, 14, 0, 0);
    let verdict = await rateLimit('ip:x', 5, kv, now);
    expect(verdict.resetSeconds).toBe(3600);

    now = Date.UTC(2026, 8, 2, 14, 45, 0);
    verdict = await rateLimit('ip:x', 5, kv, now);
    expect(verdict.resetSeconds).toBe(900);
  });

  it('degrades open when there is no store at all', async () => {
    const verdict = await rateLimit('ip:x', 5, null);
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(5);
  });
});

describe('the 24 hour cache', () => {
  it('two scans of the same domain within 24 hours produce one crawl and two results', async () => {
    const h = harness({ limit: 5 });

    const first = await h.scan('example.com');
    const second = await h.scan('example.com');

    expect(first.kind).toBe('admit');
    expect(second.kind).toBe('cached');
    if (first.kind !== 'admit' || second.kind !== 'cached') throw new Error('unreachable');
    expect(second.scanId).toBe(first.scanId);

    expect(h.state.crawls).toBe(1);
  });

  it('serves the cached scan to every caller, so a link from the index cannot be a hammer', async () => {
    const h = harness({ limit: 5 });
    await h.scan('example.com', 'ip:1.1.1.1');
    for (let i = 0; i < 40; i += 1) {
      const result = await h.scan('example.com', `ip:10.0.0.${i}`);
      expect(result.kind).toBe('cached');
    }
    expect(h.state.crawls).toBe(1);
  });

  it('does not charge a cached result against the allowance', async () => {
    const h = harness({ limit: 5 });
    await h.scan('example.com');
    for (let i = 0; i < 20; i += 1) await h.scan('example.com');
    // Five admits remain available: one was spent, four are left, and the
    // twenty cached hits cost nothing.
    for (let i = 1; i <= 4; i += 1) expect((await h.scan(`other-${i}.example`)).kind).toBe('admit');
    expect((await h.scan('other-5.example')).kind).toBe('limited');
  });

  it('crawls again after 24 hours', async () => {
    const h = harness({ limit: 5 });
    await h.scan('example.com');
    h.state.now += 24 * HOUR + 1000;
    expect((await h.scan('example.com')).kind).toBe('admit');
    expect(h.state.crawls).toBe(2);
  });

  it('falls back to the database when the cache is cold', async () => {
    // Redis restarted, or was never there. The finished scan in the database
    // is the durable answer, and the gate re-warms the cache from it.
    const h = harness({ limit: 5 });
    await h.scan('example.com');
    await h.kv.del('scan:example.com');

    const again = await h.scan('example.com');
    expect(again.kind).toBe('cached');
    expect(await h.kv.get('scan:example.com')).toBe('scan-1');
    expect(h.state.crawls).toBe(1);
  });

  it('treats a finished scan older than the window as stale', async () => {
    const h = harness({ limit: 5 });
    h.finished.set('old.example', {
      id: 'scan-old',
      finishedAt: new Date(h.state.now - 25 * HOUR).toISOString(),
    });
    expect((await h.scan('old.example')).kind).toBe('admit');
  });
});

describe('claimOnce', () => {
  it('returns true the first time and false on a replay', async () => {
    const kv = memoryKV();
    expect(await claimOnce('evt_1', 60, kv)).toBe(true);
    expect(await claimOnce('evt_1', 60, kv)).toBe(false);
    expect(await claimOnce('evt_2', 60, kv)).toBe(true);
  });

  it('fails open without a store, because the unique index is the real guard', async () => {
    expect(await claimOnce('evt_1', 60, null)).toBe(true);
    expect(await claimOnce('evt_1', 60, null)).toBe(true);
  });
});
