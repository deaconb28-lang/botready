/**
 * What survives ingest.
 *
 * Two rules are being protected here and they are the two that would be
 * expensive to get wrong.
 *
 * Constraint 9: the moment we accept somebody else's traffic logs we are a
 * processor. A human's address is read out of the batch and never written —
 * not stored, not hashed, not kept in a shape anybody could reverse. So the
 * parser is tested for what it produces and the batch shapes for what they
 * carry, and nothing downstream of `collect` has a column to put an address
 * in even if it wanted one.
 *
 * And the CIDR arithmetic, because it is what decides whether a crawler is
 * verified or a fake, and an off-by-one in a netmask is invisible until
 * somebody is looking at a number that is wrong in the flattering direction.
 */

import { describe, expect, it } from 'vitest';

import { hashToken, parseBatch } from '../lib/collect';
import { ipInCidr } from '../lib/verify-agent';

describe('reading a batch', () => {
  it('reads our own shape', () => {
    const out = parseBatch({
      hits: [{ ts: '2026-09-08T01:00:00Z', ip: '1.2.3.4', ua: 'ClaudeBot/1.0', path: '/pricing', status: 200 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ua: 'ClaudeBot/1.0', path: '/pricing', status: 200 });
  });

  it('reads a bare array, which is what a shell script produces', () => {
    const out = parseBatch([{ ua: 'GPTBot/1.2', path: '/', status: 200 }]);
    expect(out).toHaveLength(1);
  });

  it("reads Vercel's log drain, including its one-element userAgent array", () => {
    const out = parseBatch([
      {
        timestamp: 1788829000000,
        proxy: { clientIp: '5.6.7.8', userAgent: ['PerplexityBot/1.0'], path: '/docs', statusCode: 403 },
      },
    ]);
    expect(out[0]).toMatchObject({ ua: 'PerplexityBot/1.0', path: '/docs', status: 403 });
    expect(out[0]?.ts.startsWith('2026-')).toBe(true);
  });

  it('drops a line with no user agent rather than guessing at it', () => {
    expect(parseBatch([{ path: '/', status: 200 }])).toEqual([]);
    expect(parseBatch({ hits: [{}] })).toEqual([]);
  });

  it('survives a body that is not a batch at all', () => {
    expect(parseBatch(null)).toEqual([]);
    expect(parseBatch('nope')).toEqual([]);
    expect(parseBatch({ foo: 1 })).toEqual([]);
  });

  it('falls back to now for an unreadable timestamp, rather than to 1970', () => {
    const out = parseBatch([{ ua: 'GPTBot', ts: 'not a date', path: '/', status: 200 }]);
    expect(new Date(out[0]!.ts).getFullYear()).toBeGreaterThan(2020);
  });
});

describe('the ingest token', () => {
  it('is stored as a hash, so the table holds nothing usable', () => {
    const hash = hashToken('brk_live_abcdefghijklmnop');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('brk_live');
  });

  it('hashes the same token to the same value, and a different one differently', () => {
    expect(hashToken('a')).toBe(hashToken('a'));
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

describe('address containment', () => {
  it('matches inside an IPv4 range and misses outside it', () => {
    expect(ipInCidr('23.98.142.176', '23.98.142.176/28')).toBe(true);
    expect(ipInCidr('23.98.142.191', '23.98.142.176/28')).toBe(true);
    expect(ipInCidr('23.98.142.192', '23.98.142.176/28')).toBe(false);
    expect(ipInCidr('23.98.143.1', '23.98.142.0/24')).toBe(false);
  });

  it('handles the boundaries a netmask off-by-one would break', () => {
    expect(ipInCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
    expect(ipInCidr('1.2.3.4', '1.2.3.4/32')).toBe(true);
    expect(ipInCidr('1.2.3.5', '1.2.3.4/32')).toBe(false);
  });

  it('handles IPv6, including the collapsed run', () => {
    expect(ipInCidr('2600:1f00::1', '2600:1f00::/32')).toBe(true);
    expect(ipInCidr('2601:1f00::1', '2600:1f00::/32')).toBe(false);
    expect(ipInCidr('::1', '::/0')).toBe(true);
  });

  it('never matches across families, which would be a silent false positive', () => {
    expect(ipInCidr('1.2.3.4', '2600:1f00::/32')).toBe(false);
    expect(ipInCidr('2600:1f00::1', '1.2.3.0/24')).toBe(false);
  });

  it('says no to malformed input rather than throwing into a log batch', () => {
    expect(ipInCidr('not-an-ip', '1.2.3.0/24')).toBe(false);
    expect(ipInCidr('1.2.3.4', 'garbage')).toBe(false);
    expect(ipInCidr('1.2.3.4', '1.2.3.0/99')).toBe(false);
    expect(ipInCidr('999.1.1.1', '1.2.3.0/24')).toBe(false);
  });
});
