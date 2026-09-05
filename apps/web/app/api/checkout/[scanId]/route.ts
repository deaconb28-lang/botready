import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { currentUser, hasFixpackFor, ownsAnyFixpack } from '@/lib/auth';
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
  const domain = view.site.domain;

  // Already bought for this domain. Reaching checkout anyway means a stale
  // page, so send them back to the result, where the button reads Download.
  if (user && (await hasFixpackFor(user.id, domain))) {
    return NextResponse.redirect(absoluteUrl(`/scan/${scanId}`), { status: 303 });
  }

  // The second domain and every one after it is the cheaper price. Charged
  // only to somebody signed in and holding a pack already, because that is the
  // only case we can actually tell — a buyer with no session is a first
  // purchase as far as this route can know, and the webhook still attaches
  // whatever they bought to their email.
  const tier: Tier = user && (await ownsAnyFixpack(user.id)) ? 'extra' : 'first';

  const session = await createSession(scanId, domain, user?.email ?? null, tier);
  if (session?.url) return NextResponse.redirect(session.url, { status: 303 });

  // No session: no key, no price id, or Stripe said no. The link at least
  // takes the money and tells the webhook which scan it was for. It is the
  // full price whatever tier applies — a payment link is a fixed page in the
  // Stripe dashboard and cannot be told about a discount from here.
  const link = paymentLink('fixpack', scanId, user?.email);
  if (link) return NextResponse.redirect(link, { status: 303 });

  return NextResponse.json(
    { error: 'Checkout is not configured right now. Nothing was charged.' },
    { status: 502 },
  );
}

/**
 * What is being bought, priced from PRICING rather than from a price id.
 *
 * STRIPE_PRICE_FIXPACK is used when it is set, because a price defined once in
 * Stripe keeps the dashboard tidy. It is not required, and that is the point:
 * the whole checkout was falling back to the payment link — and every buyer
 * was finishing on Stripe's own page instead of ours — because one
 * environment variable was missing. A price we already state in three places
 * on the site is not a secret, and a $15 charge should not need a second
 * source of truth to happen.
 *
 * PRICING is that source, and `apps/web/__tests__/payment-link.test.ts`
 * already holds it to what the paywall says.
 */
type Tier = 'first' | 'extra';

function lineItem(tier: Tier): Stripe.Checkout.SessionCreateParams.LineItem {
  // The configured price id is the first domain only. There is no second id to
  // reach for and the repeat price is stated on the site, so the extra domain
  // is always an inline price.
  const price = tier === 'first' ? configuredPrice() : null;
  if (price) return { price, quantity: 1 };

  const pricing = tier === 'extra' ? PRICING.fixpackExtra : PRICING.fixpack;

  return {
    quantity: 1,
    price_data: {
      currency: pricing.currency,
      // Stripe counts in the currency's smallest unit.
      unit_amount: pricing.amount * 100,
      // Deliberately generic. Stripe creates a product per session for an
      // inline price, so naming the domain here would put one row in the
      // catalogue per customer. The domain is on the payment intent and in
      // metadata, which is where anyone would look for it.
      product_data:
        tier === 'extra'
          ? {
              name: 'BotReady fix pack, another domain',
              description: 'The generated files and agent prompt for one more domain.',
            }
          : {
              name: 'BotReady fix pack',
              description: 'Generated files and an agent prompt that fix what the scan found.',
            },
    },
  };
}

function configuredPrice(): string | null {
  try {
    return serverEnv.stripePriceFixpack();
  } catch {
    return null;
  }
}

/**
 * Null rather than a throw when Stripe is not configured, so the caller can
 * fall back — but never silently. A swallowed error here is the difference
 * between a buyer landing on our confirmation screen and a buyer landing on
 * Stripe's, and that is not a difference anyone should have to guess at from
 * the outside.
 */
async function createSession(scanId: string, domain: string, email: string | null, tier: Tier) {
  const pricing = tier === 'extra' ? PRICING.fixpackExtra : PRICING.fixpack;
  try {
    return await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [lineItem(tier)],
      ...(email ? { customer_email: email } : {}),
      client_reference_id: scanId,
      metadata: { scanId, domain, plan: 'fixpack', tier },
      // Both pages exist whether or not the person is signed in.
      success_url: absoluteUrl(`/scan/${scanId}/purchased?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: absoluteUrl(`/scan/${scanId}`),
      allow_promotion_codes: true,
      // The receipt line says what it is, in the product's own words.
      payment_intent_data: {
        description: `botready.dev fix pack for ${domain} (${pricing.label} ${pricing.cadence})`,
      },
    });
  } catch (err) {
    console.error('[checkout] no Stripe session for the fix pack; falling back to the payment link', err);
    return null;
  }
}

