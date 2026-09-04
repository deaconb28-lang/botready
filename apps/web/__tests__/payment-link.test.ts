/**
 * The payment link carries the purchase.
 *
 * Stripe hosts the checkout page for a payment link, so the only thing that
 * comes back on the completed session is `client_reference_id`. Everything
 * about attributing a purchase to a scan rests on this function building that
 * URL correctly, and on it refusing a host that is not Stripe's.
 */

import { describe, expect, it } from 'vitest';

import { PAYMENT_LINKS, paymentLink } from '../lib/site';

const SCAN = '725e8d54-bfcf-49f2-9567-33dfa4d3f650';

describe('paymentLink', () => {
  it('attaches the scan id as client_reference_id', () => {
    const url = new URL(paymentLink('fixpack', SCAN) ?? '');
    expect(url.searchParams.get('client_reference_id')).toBe(SCAN);
  });

  it('prefills the email when there is one, and omits it when there is not', () => {
    const withEmail = new URL(paymentLink('fixpack', SCAN, 'dana@example.com') ?? '');
    expect(withEmail.searchParams.get('prefilled_email')).toBe('dana@example.com');
    const without = new URL(paymentLink('fixpack', SCAN, null) ?? '');
    expect(without.searchParams.has('prefilled_email')).toBe(false);
  });

  it('keeps the configured link intact', () => {
    for (const plan of ['fixpack', 'monitor'] as const) {
      const url = new URL(paymentLink(plan, 'ref') ?? '');
      expect(`${url.origin}${url.pathname}`).toBe(PAYMENT_LINKS[plan]);
    }
  });

  it('points at Stripe, on https, for both plans', () => {
    for (const link of Object.values(PAYMENT_LINKS)) {
      const url = new URL(link);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('buy.stripe.com');
    }
  });

  it('is a different link per plan, so a subscriber is not charged the one-off', () => {
    expect(PAYMENT_LINKS.fixpack).not.toBe(PAYMENT_LINKS.monitor);
  });
});

describe('the host check', () => {
  // The link is overridable by environment variable, which is the one way a
  // "Buy" button could be pointed somewhere else. It refuses.
  const cases: Array<[string, string]> = [
    ['an unrelated host', 'https://buy.stripe.com.evil.test/x'],
    ['plain http', 'http://buy.stripe.com/x'],
    ['not a URL at all', 'buy.stripe.com/x'],
  ];

  for (const [name, value] of cases) {
    it(`refuses ${name}`, async () => {
      const previous = process.env.STRIPE_LINK_FIXPACK;
      process.env.STRIPE_LINK_FIXPACK = value;
      // The module reads the variable at import, so re-import it isolated.
      const fresh = await import(`../lib/site?case=${encodeURIComponent(name)}`);
      expect((fresh as { paymentLink: typeof paymentLink }).paymentLink('fixpack', SCAN)).toBeNull();
      if (previous === undefined) delete process.env.STRIPE_LINK_FIXPACK;
      else process.env.STRIPE_LINK_FIXPACK = previous;
    });
  }
});
