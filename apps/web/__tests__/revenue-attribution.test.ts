/**
 * Whose money is on the dashboard.
 *
 * This Stripe account takes payments for more than one business, and
 * `charges.list` returns all of them. The first version of the Money panel
 * summed the lot, so a Substack's income was being reported as botready's
 * revenue. These assertions are the rule that fixed it, tested as a rule.
 *
 * Both directions matter and they are not the same mistake in different
 * clothes. Counting somebody else's sale inflates a number the whole business
 * is steered by. Dropping one of ours hides a sale that really happened. The
 * panel reports what it excluded for exactly that reason.
 */

import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import { isOurSubscription, isOurs } from '../lib/admin-metrics';

const charge = (over: Record<string, unknown>) =>
  ({ metadata: {}, description: null, invoice: null, ...over }) as unknown as Stripe.Charge;

const subscription = (over: Record<string, unknown>) =>
  ({ metadata: {}, items: { data: [] }, ...over }) as unknown as Stripe.Subscription;

describe('a charge is ours when', () => {
  it('it carries the product marker, which is the only one that survives a rename', () => {
    expect(isOurs(charge({ metadata: { product: 'botready' } }))).toBe(true);
  });

  it('its description names us, which is what the fix pack route writes', () => {
    expect(isOurs(charge({ description: 'botready.dev fix pack for linear.app ($15 one time)' }))).toBe(true);
  });

  it('an expanded invoice line names us, which is where a subscription keeps it', () => {
    const invoice = { metadata: {}, lines: { data: [{ description: '1 × BotReady monitoring' }] } };
    expect(isOurs(charge({ invoice }))).toBe(true);
  });

  it('the name is capitalised differently, because product names are typed by people', () => {
    expect(isOurs(charge({ description: 'BOTREADY fix pack' }))).toBe(true);
  });
});

describe('a charge is not ours when', () => {
  it('nothing on it says so', () => {
    expect(isOurs(charge({ description: 'Substack subscription' }))).toBe(false);
  });

  it('it has no description and no invoice at all', () => {
    expect(isOurs(charge({}))).toBe(false);
  });

  it('the invoice came back unexpanded, because a string cannot be inspected', () => {
    // Better to exclude and report it than to guess. The panel prints the count.
    expect(isOurs(charge({ invoice: 'in_123' }))).toBe(false);
  });

  it('its invoice lines are somebody else’s', () => {
    const invoice = { metadata: {}, lines: { data: [{ description: '1 × Paid newsletter' }] } };
    expect(isOurs(charge({ invoice }))).toBe(false);
  });
});

describe('a subscription counts toward MRR when', () => {
  it('it carries the product marker', () => {
    expect(isOurSubscription(subscription({ metadata: { product: 'botready' } }))).toBe(true);
  });

  it('it names one of our plans, which is what the older ones have', () => {
    expect(isOurSubscription(subscription({ metadata: { plan: 'monitor' } }))).toBe(true);
    expect(isOurSubscription(subscription({ metadata: { plan: 'agency' } }))).toBe(true);
  });

  it('its expanded price product is one of ours', () => {
    const items = { data: [{ price: { product: { name: 'BotReady for agencies' } } }] };
    expect(isOurSubscription(subscription({ items }))).toBe(true);
  });

  it('and not when it is a newsletter on the same account', () => {
    const items = { data: [{ price: { product: { name: 'Monthly newsletter' } } }] };
    expect(isOurSubscription(subscription({ items }))).toBe(false);
  });

  it('and not when the product came back as an id rather than an object', () => {
    const items = { data: [{ price: { product: 'prod_123' } }] };
    expect(isOurSubscription(subscription({ items }))).toBe(false);
  });
});
