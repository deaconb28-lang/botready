import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { loadScanView } from '@/lib/scan-data';
import { absoluteUrl, PRICING, paymentLink } from '@/lib/site';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/:scanId -> 303 to Stripe
 *
 * A link rather than a form, so the button on the result page is an anchor and
 * works without JavaScript.
 *
 * Two ways to pay, and the Checkout Session comes first.
 *
 * It used to be the other way around, on the reasoning that a payment link
 * needs no secret key and no API call. What a payment link also does not have
 * is a redirect we control: where it sends someone after paying is a field in
 * the Stripe dashboard, and until somebody sets it, a buyer finishes checkout
 * on Stripe's own "payment received" page and never comes back — no
 * confirmation screen, no prompt on the page, nothing but the email. A step
 * this build cannot see, cannot test and cannot fix from here is not a step to
 * put in front of the only thing we sell.
 *
 * A Checkout Session carries its own `success_url`, so the buyer lands on the
 * confirmation screen because this file says so. The payment link stays as the
 * fallback for a deploy with no Stripe key or no price id, where it is better
 * than a 502, and it still carries the scan id as `client_reference_id` for
 * the webhook.
 *
 * No account is required to buy. Stripe collects the email, and the webhook
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

  const session = await createSession(scanId, view.site.domain, user?.email ?? null);
  if (session?.url) return NextResponse.redirect(session.url, { status: 303 });

  // No session: no key, no price id, or Stripe said no. The link at least
  // takes the money and tells the webhook which scan it was for.
  const link = paymentLink('fixpack', scanId, user?.email);
  if (link) return NextResponse.redirect(link, { status: 303 });

  return NextResponse.json(
    { error: 'Checkout is not configured right now. Nothing was charged.' },
    { status: 502 },
  );
}

/**
 * Null rather than a throw when Stripe is not configured, so the caller can
 * fall back — but never silently. A swallowed error here is the difference
 * between a buyer landing on our confirmation screen and a buyer landing on
 * Stripe's, and that is not a difference anyone should have to guess at from
 * the outside.
 */
async function createSession(scanId: string, domain: string, email: string | null) {
  try {
    return await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: serverEnv.stripePriceFixpack(), quantity: 1 }],
      ...(email ? { customer_email: email } : {}),
      client_reference_id: scanId,
      metadata: { scanId, domain, plan: 'fixpack' },
      // Both pages exist whether or not the person is signed in.
      success_url: absoluteUrl(`/scan/${scanId}/purchased?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: absoluteUrl(`/scan/${scanId}`),
      allow_promotion_codes: true,
      // The receipt line says what it is, in the product's own words.
      payment_intent_data: {
        description: `botready.dev fix pack for ${domain} (${PRICING.fixpack.label} ${PRICING.fixpack.cadence})`,
      },
    });
  } catch (err) {
    console.error('[checkout] no Stripe session for the fix pack; falling back to the payment link', err);
    return null;
  }
}

