import { stripe } from './stripe';

/**
 * Proof of purchase that does not need an account.
 *
 * Somebody who has just paid is, almost always, not signed in — a payment link
 * is a page Stripe hosts and nothing in it creates a session here. Gating the
 * confirmation screen on `currentUser()` therefore showed the person who had
 * just paid the least, which is the wrong way round.
 *
 * Stripe already solved this: the return URL carries the checkout session id,
 * and the session is authoritative about whether money moved and what for. We
 * retrieve it and check both. It cannot be forged — the id is opaque and the
 * answer comes from Stripe rather than from the URL — and it cannot be reused
 * for a different scan, because the session names the scan it paid for.
 */

export interface VerifiedPurchase {
  scanId: string;
  email: string | null;
}

/**
 * The purchase behind a checkout session, or null. Never throws: an unreachable
 * Stripe means we fall back to the signed-in path rather than 500 on the page
 * somebody lands on straight after paying.
 */
export async function verifiedPurchase(sessionId: string | null | undefined): Promise<VerifiedPurchase | null> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return null;

    // A Checkout Session we made carries the scan in metadata; a payment link
    // carries it in client_reference_id, which is the only thing we can hang on
    // a page Stripe hosts.
    const scanId = session.metadata?.scanId ?? session.client_reference_id ?? null;
    if (!scanId) return null;

    return { scanId, email: session.customer_details?.email ?? session.customer_email ?? null };
  } catch {
    return null;
  }
}

/** Whether this session paid for this particular scan. */
export async function purchaseCovers(sessionId: string | null | undefined, scanId: string): Promise<boolean> {
  const purchase = await verifiedPurchase(sessionId);
  return purchase?.scanId === scanId;
}
