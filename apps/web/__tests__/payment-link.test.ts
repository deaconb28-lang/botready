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
    const url = new URL(paymentLink('fixpack', 'ref') ?? '');
    expect(`${url.origin}${url.pathname}`).toBe(PAYMENT_LINKS.fixpack);
  });

  it('points at Stripe, on https, for every link that is configured', () => {
    // The monitor link has no default: it was a $5/month link and the plan is
    // $29, so shipping it would charge a quarter of the price. Empty is the
    // correct value until a $29 link exists, and the checkout route falls back
    // to a clean "nothing was charged" rather than to the wrong amount.
    for (const link of Object.values(PAYMENT_LINKS).filter(Boolean)) {
      const url = new URL(link);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('buy.stripe.com');
    }
  });

  it('returns null for the monitor plan until a correctly-priced link is set', () => {
    expect(PAYMENT_LINKS.monitor).toBe('');
    expect(paymentLink('monitor', 'ref')).toBeNull();
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

describe('the Stripe secret key', () => {
  // Stripe's dashboard says "secret key" and its docs say "API key". Somebody
  // setting this up reads one page, not both.
  const NAMES = ['STRIPE_SECRET_KEY', 'STRIPE_API_KEY'] as const;

  for (const name of NAMES) {
    it(`is read from ${name}`, async () => {
      const before = { ...process.env };
      for (const n of NAMES) delete process.env[n];
      process.env[name] = 'sk_test_from_' + name;

      const { serverEnv } = await import(`../lib/env?key=${name}`);
      expect(serverEnv.stripeSecretKey()).toBe('sk_test_from_' + name);

      process.env = before;
    });
  }

  it('says both names when neither is set', async () => {
    const before = { ...process.env };
    for (const n of NAMES) delete process.env[n];

    // The query string gives each case its own module instance, since the
    // variables are read once at import. Built rather than literal so the
    // compiler does not try to resolve it as a real path.
    const { serverEnv } = await import(`../lib/env?key=${'none'}`);
    expect(() => serverEnv.stripeSecretKey()).toThrow(/STRIPE_SECRET_KEY.*STRIPE_API_KEY/);

    process.env = before;
  });
});
