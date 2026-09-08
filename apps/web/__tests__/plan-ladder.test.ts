/**
 * The plans, held together.
 *
 * Three pages and one markdown builder describe what botready sells, and
 * before the ladder existed they had already drifted: the billing page was
 * still offering monitoring as the top of the range, and /pricing.md — the
 * version an assistant reads — described three domains when the constant said
 * something else. These assertions are the parts of "the tiers agree with each
 * other" that a unit test can hold.
 *
 * The rule the last group protects is the one worth stating out loud: a tier
 * we have not built is never advertised as available. It has no checkout path,
 * and its JSON-LD offer is a PreOrder. Selling the answer plane before it
 * exists would break constraint 11 by a different door.
 */

import { describe, expect, it } from 'vitest';

import {
  EARLY_ACCESS,
  LISTED_PLANS,
  PLAN_LADDER,
  PLAN_LIMITS,
  PRICING,
  nextRung,
  rung,
  upgradeHref,
} from '../lib/site';
import { markdownFor } from '../lib/markdown';

describe('the ladder', () => {
  it('has a rung for every plan, and a plan for every rung', () => {
    expect(PLAN_LADDER.map((r) => r.id)).toEqual(Object.keys(PLAN_LIMITS));
  });

  it('gets bigger as it gets more expensive', () => {
    const pairs = PLAN_LADDER.slice(1).map((above, i) => [PLAN_LADDER[i]!, above] as const);
    for (const [below, above] of pairs) {
      expect(above.domains).toBeGreaterThan(below.domains);
      expect(above.prompts).toBeGreaterThanOrEqual(below.prompts);
    }
  });

  it('quotes the same prices the checkout charges', () => {
    expect(rung('monitor').price).toBe(PRICING.monitor.label);
    expect(rung('agency').price).toBe(PRICING.agency.label);
    expect(rung('free').price).toBeNull();
  });

  it('walks upward past the unlisted rungs and stops at the top', () => {
    // Somebody on free must not be offered a plan they cannot find on the
    // pricing page, so monitoring is skipped. Somebody already on monitoring
    // still gets agency, which is the next listed rung either way.
    expect(nextRung('free')?.id).toBe('agency');
    expect(nextRung('monitor')?.id).toBe('agency');
    expect(nextRung('agency')).toBeNull();
  });

  it('sends an upgrade to checkout only when checkout needs nothing else', () => {
    // Monitoring is bought for a claimed domain, so a button with no site in
    // hand has to go somewhere the person can pick one.
    expect(upgradeHref(rung('monitor'))).toBe('/pricing');
    expect(upgradeHref(rung('agency'))).toBe('/api/checkout/agency');
  });
});

describe('the readable pricing page', () => {
  const md = markdownFor('/pricing') ?? '';

  it('exists', () => {
    expect(md).not.toBe('');
  });

  it('names every plan on offer, with its price', () => {
    for (const r of LISTED_PLANS) {
      if (!r.price) continue;
      expect(md).toContain(r.price);
    }
    expect(md).toContain(PRICING.fixpack.label);
  });

  it('does not offer an unlisted plan', () => {
    // Monitoring still renews for the people on it. It is not sold to anybody
    // else, and a price on this page is an offer.
    expect(md).not.toContain(`## Monitoring`);
  });

  it('quotes the domain count from the constants rather than from memory', () => {
    expect(md).toContain(String(PLAN_LIMITS.agency.domains));
  });

  it('says the early-access tier is not for sale', () => {
    expect(md).toContain(EARLY_ACCESS.scale.label);
    expect(md.toLowerCase()).toContain('not for sale');
  });
});

describe('what is not built is not sold', () => {
  it('keeps the early-access tier off the ladder', () => {
    expect(PLAN_LADDER.some((r) => r.price === EARLY_ACCESS.scale.label)).toBe(false);
  });

  it('marks it unavailable', () => {
    expect(EARLY_ACCESS.scale.available).toBe(false);
  });

  it('gives every priced rung a way to pay, and free none', () => {
    for (const r of PLAN_LADDER) {
      if (r.price) expect(r.checkoutPath).toMatch(/^\/api\/checkout\//);
      else expect(r.checkoutPath).toBeNull();
    }
  });

  it('keeps an unlisted plan payable, so a subscriber on it can still renew', () => {
    // Unlisting is a decision about who is offered a plan, not about who is
    // allowed to keep one. A plan that could not be paid for would cancel
    // itself at the next renewal, which is a worse outcome than a fourth card.
    const monitor = rung('monitor');
    expect(monitor.listed).toBe(false);
    expect(monitor.checkoutPath).toBe('/api/checkout/monitor');
    expect(monitor.price).toBe(PRICING.monitor.label);
  });

  it('offers exactly the rungs marked listed', () => {
    expect(LISTED_PLANS.map((r) => r.id)).toEqual(['free', 'agency']);
  });
});
