import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { currentUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { referral } from '@/lib/affonso-server';
import { PLAN_LIMITS, PRICING, absoluteUrl } from '@/lib/site';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/agency -> 303 to Stripe, for the ten-domain subscription.
 *
 * Account-level rather than per-site, which is the whole difference from
 * monitoring: the thing being bought is a seat over a portfolio, and the
 * domains arrive afterwards through the claim flow. So there is no site id in
 * the path, nothing to check ownership of before charging, and no payment-link
 * fallback — a hosted link cannot say which of the two subscriptions it was,
 * and the webhook reads that from metadata. See `planOf` in the webhook.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/sign-in?next=${encodeURIComponent('/api/checkout/agency')}`), 303);
  }

  const session = await createSession(user.email);
  if (session?.url) return NextResponse.redirect(session.url, { status: 303 });

  return NextResponse.json({ error: 'Checkout is not configured right now. Nothing was charged.' }, { status: 502 });
}

/**
 * Priced from PRICING when no price id is configured, so the tier works before
 * anyone has been into the Stripe dashboard. A missing environment variable
 * should not be able to quietly downgrade checkout, which is why the inline
 * price is the same number the page printed rather than a default.
 */
function lineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = configuredPrice();
  if (price) return { price, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: PRICING.agency.currency,
      unit_amount: PRICING.agency.amount * 100,
      recurring: { interval: 'month' },
      product_data: {
        name: 'BotReady for agencies',
        description: `Weekly re-checks of up to ${PLAN_LIMITS.agency.domains} domains, ${PLAN_LIMITS.agency.prompts} watched questions across all of them, and every fix pack included.`,
      },
    },
  };
}

function configuredPrice(): string | null {
  try {
    return serverEnv.stripePriceAgency();
  } catch {
    return null;
  }
}

async function createSession(email: string) {
  const affonso_referral = await referral();
  try {
    return await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem()],
      customer_email: email,
      // No client_reference_id: there is no one site this covers. The webhook
      // writes the grant unlimited for exactly that reason.
      metadata: { plan: 'agency', affonso_referral },
      subscription_data: { metadata: { plan: 'agency', affonso_referral } },
      // To the domain list, because the first thing an agency does after
      // paying is add the nine other clients.
      success_url: absoluteUrl('/account?subscribed=agency'),
      cancel_url: absoluteUrl('/pricing'),
      allow_promotion_codes: true,
    });
  } catch (err) {
    console.error('[checkout] no Stripe session for the agency plan', err);
    return null;
  }
}
