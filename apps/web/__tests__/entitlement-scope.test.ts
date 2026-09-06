/**
 * What one purchase covers.
 *
 * The download route takes an arbitrary scan id, so this rule is the only thing
 * standing between "bought the fix pack for one domain" and "bought the fix
 * pack for every domain anyone has ever scanned". It is a pure function for
 * exactly that reason: the interesting part is the rule, not the query.
 */

import { describe, expect, it } from 'vitest';

import { UNLIMITED, claimable, coversDomain, live, type EntitlementRow } from '../lib/auth';

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

describe('a purchase written before the pack was scoped', () => {
  // These used to be null and are now marked UNLIMITED by migration 0009.
  // Nobody who has already paid loses what they paid for, and no backfill could
  // invent a scope the purchase never had. What changed is that null stopped
  // meaning the same thing, because null is also what a failed lookup writes.
  it('covers everything, because that is what it was sold as', () => {
    expect(coversDomain([fixpack(UNLIMITED)], 'anything.com', NOW)).toBe(true);
    expect(coversDomain([fixpack(UNLIMITED)], 'anything-else.com', NOW)).toBe(true);
  });

  it('still covers everything when the caller cannot name a domain either', () => {
    expect(coversDomain([fixpack(UNLIMITED)], null, NOW)).toBe(true);
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

describe('a grant with no domain on it yet', () => {
  // Null used to mean every domain, which is also what a grant looks like when
  // the webhook could not name one — so a payment link with nothing attached
  // bought the whole index. Null now means one pack that has not been spent.
  it('covers the first domain it is asked for', () => {
    expect(coversDomain([fixpack(null)], 'one.com', NOW)).toBe(true);
  });

  it('is reported as claimable, so the caller stamps it', () => {
    expect(claimable([fixpack(null)], 'one.com', NOW)).toBe(true);
  });

  it('is not claimable once it names that domain, which is the spent state', () => {
    expect(claimable([fixpack('one.com')], 'one.com', NOW)).toBe(false);
    expect(coversDomain([fixpack('one.com')], 'two.com', NOW)).toBe(false);
  });

  it('is not claimable when something else already covers the domain', () => {
    // The unlimited grant answers for it, so the unspent one stays unspent.
    const rows = [fixpack(UNLIMITED), fixpack(null)];
    expect(claimable(rows, 'one.com', NOW)).toBe(false);
  });

  it('cannot be spent by a caller that cannot name a domain', () => {
    expect(coversDomain([fixpack(null)], null, NOW)).toBe(false);
    expect(claimable([fixpack(null)], null, NOW)).toBe(false);
  });
});

describe('the explicit unlimited grant', () => {
  it('covers everything, because that is what it was sold as', () => {
    expect(coversDomain([fixpack(UNLIMITED)], 'one.com', NOW)).toBe(true);
    expect(coversDomain([fixpack(UNLIMITED)], 'two.com', NOW)).toBe(true);
  });

  it('covers everything even when the caller cannot name a domain', () => {
    expect(coversDomain([fixpack(UNLIMITED)], null, NOW)).toBe(true);
  });

  it('is the only thing that unlocks a second domain', () => {
    // The whole point: one $15 pack is one domain, and the second is $5.
    expect(coversDomain([fixpack('one.com')], 'two.com', NOW)).toBe(false);
  });
});
