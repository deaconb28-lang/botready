/**
 * Proof of purchase without an account.
 *
 * The confirmation screen and the download both used to require a session, and
 * somebody who has just paid through a payment link does not have one — since
 * sign-in became Google-only, a buyer whose card email is not a Google account
 * could not get one at all. These assert the replacement is actually a check
 * and not a decoration: the answer comes from Stripe, an unpaid session does
 * not open anything, and a session for one scan does not open another.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const retrieve = vi.fn();
vi.mock('../lib/stripe', () => ({ stripe: () => ({ checkout: { sessions: { retrieve } } }) }));

const { verifiedPurchase, purchaseCovers } = await import('../lib/purchase');

afterEach(() => retrieve.mockReset());

const paid = (over: Record<string, unknown> = {}) => ({
  payment_status: 'paid',
  client_reference_id: 'scan-a',
  customer_details: { email: 'buyer@example.com' },
  ...over,
});

describe('verifiedPurchase', () => {
  it('accepts a paid session and reports the scan it paid for', async () => {
    retrieve.mockResolvedValue(paid());
    await expect(verifiedPurchase('cs_test_123')).resolves.toEqual({
      scanId: 'scan-a',
      email: 'buyer@example.com',
    });
  });

  it('prefers the metadata scan id, which our own Checkout Sessions carry', async () => {
    retrieve.mockResolvedValue(paid({ metadata: { scanId: 'scan-meta' } }));
    expect((await verifiedPurchase('cs_test_123'))?.scanId).toBe('scan-meta');
  });

  it('refuses a session that has not been paid', async () => {
    retrieve.mockResolvedValue(paid({ payment_status: 'unpaid' }));
    await expect(verifiedPurchase('cs_test_123')).resolves.toBeNull();
  });

  it('refuses a paid session that names no scan', async () => {
    retrieve.mockResolvedValue(paid({ client_reference_id: null }));
    await expect(verifiedPurchase('cs_test_123')).resolves.toBeNull();
  });

  it('never calls Stripe for something that is not a session id', async () => {
    // The id comes off a query string. Anything shaped wrong is refused before
    // it becomes a request, so a URL cannot be used to probe Stripe.
    for (const bad of [null, undefined, '', 'sub_123', '../../etc', 'cs_test_123; drop']) {
      await expect(verifiedPurchase(bad)).resolves.toBeNull();
    }
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('falls back to null rather than throwing when Stripe is unreachable', async () => {
    retrieve.mockRejectedValue(new Error('network'));
    await expect(verifiedPurchase('cs_test_123')).resolves.toBeNull();
  });
});

describe('purchaseCovers', () => {
  it('opens the scan the session paid for', async () => {
    retrieve.mockResolvedValue(paid());
    await expect(purchaseCovers('cs_test_123', 'scan-a')).resolves.toBe(true);
  });

  it('does not open a different scan', async () => {
    // A session id is not a skeleton key: it unlocks the one thing it bought.
    retrieve.mockResolvedValue(paid());
    await expect(purchaseCovers('cs_test_123', 'scan-b')).resolves.toBe(false);
  });
});
