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

import { readFile } from 'node:fs/promises';

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

  it('a bare product id resolves to one of our names', () => {
    // The id is what Stripe actually sends: a subscription item carries its
    // price as an object and its product as an id, and the expand that would
    // have inlined it is one level past the limit. So the name arrives from a
    // second lookup, and this is the path that carries every older
    // subscription's only evidence of whose it is.
    const items = { data: [{ price: { product: 'prod_123' } }] };
    const names = new Map([['prod_123', 'BotReady for agencies']]);
    expect(isOurSubscription(subscription({ items }), (id) => names.get(id) ?? null)).toBe(true);
  });

  it('and not when a bare id resolves to somebody else', () => {
    const items = { data: [{ price: { product: 'prod_sub' } }] };
    const names = new Map([['prod_sub', 'Monthly newsletter']]);
    expect(isOurSubscription(subscription({ items }), (id) => names.get(id) ?? null)).toBe(false);
  });

  it('and not when the product came back as an id nothing could resolve', () => {
    const items = { data: [{ price: { product: 'prod_123' } }] };
    expect(isOurSubscription(subscription({ items }))).toBe(false);
  });
});

/**
 * The bug this half of the file exists to prevent from returning.
 *
 * `charges.list` and `subscriptions.list` were issued as one `Promise.all`,
 * and the subscription call carried `expand: ['data.items.data.price.product']`
 * — five levels, where Stripe allows four. It failed every time, took the
 * charges down with it, and the Money panel drew its "Stripe did not answer"
 * empty state for days while Stripe was answering fine about the charges.
 */
describe('what we ask Stripe for', () => {
  it('never expands more than four levels', async () => {
    const source = await readFile(new URL('../lib/admin-metrics.ts', import.meta.url), 'utf8');
    const expands = [...source.matchAll(/expand:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((p) => p[1] ?? ''),
    );
    expect(expands.length).toBeGreaterThan(0);
    for (const path of expands) {
      expect(path.split('.').length, `${path} is too deep for Stripe`).toBeLessThanOrEqual(4);
    }
  });
});
