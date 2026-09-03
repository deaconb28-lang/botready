import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { loadScanView } from '@/lib/scan-data';
import { absoluteUrl, PRICING } from '@/lib/site';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/:scanId -> 303 to Stripe Checkout
 *
 * A link rather than a form, so the button on the result page is an anchor and
 * works without JavaScript. The scan id travels in the session metadata, which
 * is how the webhook knows what was bought; the price is Stripe's, from the
 * configured price id, and never a number this code holds.
 *
 * No account is required to buy. Checkout collects the email, and the webhook
 * turns it into a user and an entitlement.
 */
export async function GET(_request: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  const view = await loadScanView(scanId);
  if (!view) {
    return NextResponse.json({ error: 'No scan with that id.' }, { status: 404 });
  }
  if (!view.score) {
    return NextResponse.json(
      { error: 'This scan did not produce a result, so there is no fix pack to generate for it.' },
      { status: 409 },
    );
  }

  const user = await currentUser();

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: serverEnv.stripePriceFixpack(), quantity: 1 }],
    ...(user ? { customer_email: user.email } : {}),
    metadata: {
      scanId,
      domain: view.site.domain,
      plan: 'fixpack',
    },
    // Both pages exist whether or not the person is signed in.
    success_url: absoluteUrl(`/scan/${scanId}/purchased?session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: absoluteUrl(`/scan/${scanId}`),
    allow_promotion_codes: true,
    // The receipt line says what it is, in the product's own words.
    payment_intent_data: {
      description: `botready.dev fix pack for ${view.site.domain} (${PRICING.fixpack.label} ${PRICING.fixpack.cadence})`,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'Stripe did not return a checkout URL. Nothing was charged. Try again.' },
      { status: 502 },
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
