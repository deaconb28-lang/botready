/**
 * What one purchase covers.
 *
 * The download route takes an arbitrary scan id, so this rule is the only thing
 * standing between "bought the fix pack for one domain" and "bought the fix
 * pack for every domain anyone has ever scanned". It is a pure function for
 * exactly that reason: the interesting part is the rule, not the query.
 */

import { describe, expect, it } from 'vitest';

import { coversDomain, live, type EntitlementRow } from '../lib/auth';

const NOW = Date.parse('2026-09-05T12:00:00Z');
const NEXT_MONTH = '2026-10-05T12:00:00Z';
const LAST_MONTH = '2026-08-05T12:00:00Z';

const fixpack = (domain: string | null): EntitlementRow => ({
  plan: 'fixpack',
  current_period_end: null,
  domain,
});

const monitor = (domain: string | null, end: string | null): EntitlementRow => ({
  plan: 'monitor',
  current_period_end: end,
  domain,
});

describe('a fix pack covers the domain it was bought for', () => {
  it('unlocks that domain', () => {
    expect(coversDomain([fixpack('example.com')], 'example.com', NOW)).toBe(true);
  });

  it('does not unlock a different one', () => {
    // The whole point. One $15 payment used to hand over every generated pack
    // on the site, and the public index is a list of domains to try it on.
    expect(coversDomain([fixpack('example.com')], 'competitor.com', NOW)).toBe(false);
  });

  it('ignores case and surrounding space on either side', () => {
    expect(coversDomain([fixpack('Example.COM')], ' example.com ', NOW)).toBe(true);
  });

  it('never expires', () => {
    // A fix pack is a one-off purchase. Re-scan for a year and it still opens.
    expect(coversDomain([fixpack('example.com')], 'example.com', NOW + 1e12)).toBe(true);
  });

  it('adds up across purchases', () => {
    const held = [fixpack('one.com'), fixpack('two.com')];
    expect(coversDomain(held, 'one.com', NOW)).toBe(true);
    expect(coversDomain(held, 'two.com', NOW)).toBe(true);
    expect(coversDomain(held, 'three.com', NOW)).toBe(false);
  });
});

describe('a purchase with no domain on it', () => {
  it('covers everything, because that is what it was sold as', () => {
    // Rows written before the fix pack became per-domain. Nobody who has
    // already paid loses what they paid for, and no backfill could invent a
    // scope the purchase never had.
    expect(coversDomain([fixpack(null)], 'anything.com', NOW)).toBe(true);
    expect(coversDomain([fixpack(null)], 'anything-else.com', NOW)).toBe(true);
  });

  it('still covers everything when the caller cannot name a domain either', () => {
    expect(coversDomain([fixpack(null)], null, NOW)).toBe(true);
  });
});

describe('monitoring', () => {
  it('includes the pack for the domain it monitors, which is what pricing says', () => {
    expect(coversDomain([monitor('example.com', NEXT_MONTH)], 'example.com', NOW)).toBe(true);
  });

  it('does not include it for anything else', () => {
    expect(coversDomain([monitor('example.com', NEXT_MONTH)], 'other.com', NOW)).toBe(false);
  });

  it('stops including it once the subscription lapses', () => {
    expect(coversDomain([monitor('example.com', LAST_MONTH)], 'example.com', NOW)).toBe(false);
  });

  it('with no period end at all is not live', () => {
    expect(live(monitor('example.com', null), NOW)).toBe(false);
  });

  it('a lapsed subscription does not take away a fix pack bought outright', () => {
    const held = [monitor('example.com', LAST_MONTH), fixpack('example.com')];
    expect(coversDomain(held, 'example.com', NOW)).toBe(true);
  });
});

describe('holding nothing', () => {
  it('covers nothing', () => {
    expect(coversDomain([], 'example.com', NOW)).toBe(false);
    expect(coversDomain([], null, NOW)).toBe(false);
  });

  it('a domain-scoped row never matches a caller with no domain', () => {
    // A download that cannot say which domain it is for must not be answered
    // by a purchase that names one.
    expect(coversDomain([fixpack('example.com')], null, NOW)).toBe(false);
  });
});
