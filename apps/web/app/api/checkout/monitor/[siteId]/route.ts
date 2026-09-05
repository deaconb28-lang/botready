import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { currentUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { PRICING, absoluteUrl, paymentLink } from '@/lib/site';
import { stripe } from '@/lib/stripe';
import { publicClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/monitor/:siteId -> 303 to Stripe, for the subscription.
 *
 * Only for a site this person has claimed. The site id rides along as
 * `client_reference_id` on the payment link, or in metadata on a Checkout
 * Session; either way the webhook grants the first period and `invoice.paid`
 * extends it.
 */
export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params;
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/sign-in?next=${encodeURIComponent(`/api/checkout/monitor/${siteId}`)}`), 303);
  }

  const { data: site } = await publicClient()
    .from('sites')
    .select('domain, claimed_by')
    .eq('id', siteId)
    .maybeSingle();

  const row = site as { domain: string; claimed_by: string | null } | null;
  if (!row) return NextResponse.json({ error: 'No site with that id.' }, { status: 404 });
  if (row.claimed_by !== user.id) {
    return NextResponse.json({ error: `Claim ${row.domain} first. Monitoring is for a site you have proven you control.` }, { status: 403 });
  }

  // Session first, link second, for the reason spelled out in the fix pack's
  // route: a payment link's redirect lives in the Stripe dashboard and this
  // one's `success_url` lives here.
  const session = await createSession(siteId, row.domain, user.email);
  if (session?.url) return NextResponse.redirect(session.url, { status: 303 });

  const link = paymentLink('monitor', siteId, user.email);
  if (link) return NextResponse.redirect(link, { status: 303 });

  return NextResponse.json({ error: 'Checkout is not configured right now. Nothing was charged.' }, { status: 502 });
}

/**
 * The subscription, priced from PRICING when no price id is configured — same
 * reasoning as the fix pack's route, and the same reason: a missing
 * environment variable should not be able to quietly downgrade checkout.
 */
function lineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = configuredPrice();
  if (price) return { price, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: PRICING.monitor.currency,
      unit_amount: PRICING.monitor.amount * 100,
      recurring: { interval: 'month' },
      product_data: {
        name: 'BotReady monitoring',
        description: 'Weekly re-checks, and an alert the day a rule changes under you.',
      },
    },
  };
}

function configuredPrice(): string | null {
  try {
    return serverEnv.stripePriceMonitor();
  } catch {
    return null;
  }
}

/** Null rather than a throw when Stripe is not configured, so the caller can fall back. */
async function createSession(siteId: string, domain: string, email: string) {
  try {
    return await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem()],
      customer_email: email,
      client_reference_id: siteId,
      metadata: { plan: 'monitor', siteId, domain },
      subscription_data: { metadata: { plan: 'monitor', siteId, domain } },
      // Into the app, not back to the claim page they started on. The claim
      // page is where somebody goes to prove a domain is theirs; landing there
      // after paying says nothing about what they just bought. `subscribed=1`
      // is what raises the thank-you, and the toast strips it once shown.
      success_url: absoluteUrl(`/app/${domain}?subscribed=1`),
      cancel_url: absoluteUrl(`/claim/${domain}`),
      // Same as the fix pack. A code that works on one and not the other is
      // the kind of thing you find out about from the person it failed for.
      allow_promotion_codes: true,
    });
  } catch (err) {
    console.error('[checkout] no Stripe session for monitoring; falling back to the payment link', err);
    return null;
  }
}
