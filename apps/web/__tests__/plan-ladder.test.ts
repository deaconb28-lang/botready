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

import { ENGINES, cycleCostUsd, monthlyAskCostUsd } from '@botready/core';

import {
  CONTACT_EMAIL,
  EARLY_ACCESS,
  ENTERPRISE,
  LISTED_PLANS,
  PLAN_LADDER,
  PLAN_LIMITS,
  PRICING,
  WATCHED_PER_WEEK,
  contactHref,
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

  it('does not offer the early-access tier at all', () => {
    // Stronger than the assertion this replaces, which only checked that the
    // tier was labelled "not for sale" where it appeared. It has been pulled
    // from the page for now, and the markdown is the page — a tier described
    // here but absent from the HTML is exactly the disagreement this file
    // exists to catch. EARLY_ACCESS itself stays: it is still the floor the
    // enterprise band quotes, and still `available: false` below.
    expect(md).not.toContain('Early access');
    expect(md).not.toContain(EARLY_ACCESS.scale.label);
  });
});

/**
 * The enterprise band, which prints one number and takes no money.
 *
 * Both halves matter. A floor that disagrees with the tier above it is the
 * cheapest way to lose a large customer, and a "talk to us" that quietly
 * acquired a checkout would be selling a cadence nobody has agreed to.
 */
describe('the enterprise floor', () => {
  it('is the same number as the tier it starts from', () => {
    expect(ENTERPRISE.from.amount).toBe(EARLY_ACCESS.scale.amount);
    expect(ENTERPRISE.from).toBe(EARLY_ACCESS.scale);
  });

  it('has no checkout, on the ladder or off it', () => {
    expect(ENTERPRISE).not.toHaveProperty('checkoutPath');
    expect(PLAN_LADDER.some((r) => r.label.toLowerCase().includes('enterprise'))).toBe(false);
  });

  it('reaches a person, with an encoded subject', () => {
    const href = contactHref(ENTERPRISE.subject);
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(href).not.toMatch(/subject=[^&]*\s/);
    expect(decodeURIComponent(href.split('subject=')[1] ?? '')).toBe(ENTERPRISE.subject);
  });

  it('is in the markdown too, so a crawler reads the same offer a person does', () => {
    const md = markdownFor('/pricing') ?? '';
    expect(md.toLowerCase()).toContain('enterprise');
    expect(md).toContain(String(ENTERPRISE.from.amount));
  });
});

/**
 * The price justification is derived, not typed.
 *
 * It is printed on the page as the reason $179 is $179, which makes it the one
 * figure on the pricing page that must move when the catalog does. An engine
 * added to engines.json at four cents a run raises our cost, and a page still
 * quoting the old month is a page arguing for a margin we no longer have.
 */
describe('what the answer plane costs us', () => {
  it('reads every engine in the catalog', () => {
    const expected = Math.round((cycleCostUsd(WATCHED_PER_WEEK, ENGINES.map((e) => e.id)) * 52) / 12);
    expect(monthlyAskCostUsd(WATCHED_PER_WEEK)).toBe(expected);
  });

  it('scales with how much is asked', () => {
    expect(monthlyAskCostUsd(200)).toBe(monthlyAskCostUsd(100) * 2);
  });

  it('stays under the price it is quoted to justify', () => {
    // Not a style rule. If asking costs more than the plan charges, the plan
    // loses money on every customer and the number on the page is fiction.
    expect(monthlyAskCostUsd(WATCHED_PER_WEEK)).toBeLessThan(EARLY_ACCESS.scale.amount);
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
