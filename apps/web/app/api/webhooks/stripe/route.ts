import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { grantEntitlement, supabaseStore, type Plan } from '@/lib/entitlements';
import { claimOnce } from '@/lib/redis';
import { serviceClient } from '@/lib/supabase';
import { verifyWebhook } from '@/lib/stripe';
import { sendFixpackReady } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * The raw body is read first and JSON parsing comes after, because the
 * signature is over the exact bytes Stripe sent. Then the event is applied
 * exactly once: entitlements.stripe_event_id is unique, so a retry of an
 * event already granted is answered 200 and does nothing.
 *
 * Always 200 once the signature verifies, even for events we do not handle.
 * Anything else makes Stripe retry, and a retry of an event we were never going
 * to act on is noise in the dashboard for a week.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'No stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhook(rawBody, signature);
  } catch (err) {
    return NextResponse.json(
      { error: `The signature did not verify: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  // The fast path for a replay. Fails open; the unique index is the guard.
  const fresh = await claimOnce(`stripe:${event.id}`);
  if (!fresh) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckout(event.data.object, event.id);

    case 'invoice.paid':
      // A subscription renewal. Extends the monitor entitlement by a period.
      return handleRenewal(event.data.object, event.id);

    default:
      return NextResponse.json({ received: true, handled: false, type: event.type });
  }
}

async function handleCheckout(session: Stripe.Checkout.Session, eventId: string) {
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    // Nothing to attach the purchase to. Stripe still gets its 200 so it does
    // not retry a session that will never gain an email; the dashboard shows
    // the session, and the person has a receipt with a support address on it.
    return NextResponse.json({ received: true, handled: false, reason: 'no email on session' });
  }

  const plan: Plan = session.metadata?.plan === 'monitor' ? 'monitor' : 'fixpack';
  const scanId = session.metadata?.scanId ?? null;
  const domain = session.metadata?.domain ?? null;

  const outcome = await grantEntitlement(supabaseStore(serviceClient()), {
    eventId,
    email,
    plan,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
    currentPeriodEnd: plan === 'monitor' ? periodEndFor(session) : null,
  });

  if (outcome.granted && scanId) {
    // Best effort. A missing email is a support ticket; a failed webhook is a
    // retry that grants nothing and confuses everyone.
    await sendFixpackReady({ to: email, scanId, domain }).catch(() => {});
  }

  return NextResponse.json({
    received: true,
    handled: true,
    granted: outcome.granted,
    duplicate: outcome.duplicate,
  });
}

async function handleRenewal(invoice: Stripe.Invoice, eventId: string) {
  const email = invoice.customer_email;
  if (!email || !invoice.subscription) {
    return NextResponse.json({ received: true, handled: false, reason: 'no email or subscription' });
  }

  const periodEnd = invoice.lines.data[0]?.period?.end;
  const outcome = await grantEntitlement(supabaseStore(serviceClient()), {
    eventId,
    email,
    plan: 'monitor',
    stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  });

  return NextResponse.json({
    received: true,
    handled: true,
    granted: outcome.granted,
    duplicate: outcome.duplicate,
  });
}

/** A month from checkout for a new subscription. The renewal invoice corrects it. */
function periodEndFor(session: Stripe.Checkout.Session): Date {
  const created = session.created ? new Date(session.created * 1000) : new Date();
  return new Date(created.getTime() + 31 * 24 * 3600 * 1000);
}
