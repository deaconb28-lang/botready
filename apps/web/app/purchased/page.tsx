import { notFound, redirect } from 'next/navigation';

import { verifiedPurchase } from '@/lib/purchase';

export const dynamic = 'force-dynamic';

/**
 * Where a Stripe payment link lands.
 *
 * A payment link's redirect URL is fixed in the Stripe dashboard and cannot
 * carry the scan, because Stripe hosts that page and never sees our routing.
 * What it can carry is the checkout session id — and the session knows which
 * scan it paid for, because we hung it on `client_reference_id` on the way out.
 *
 * So this reads the session, finds the scan, and forwards. Set the payment
 * link's "Redirect to your website" to:
 *
 *   https://www.botready.dev/purchased?session_id={CHECKOUT_SESSION_ID}
 */
export default async function PurchasedLanding({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const purchase = await verifiedPurchase(sessionId);

  // No session, or one Stripe will not vouch for. Nothing here is a page.
  if (!purchase || !sessionId) notFound();

  redirect(`/scan/${purchase.scanId}/purchased?session_id=${encodeURIComponent(sessionId)}`);
}
