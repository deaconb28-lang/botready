import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { grantEntitlement, supabaseStore, type Plan } from '@/lib/entitlements';
import { claimOnce } from '@/lib/redis';
import { serviceClient } from '@/lib/supabase';
import { verifyWebhook } from '@/lib/stripe';
import { sendFixpackReady, sendMonitorStarted } from '@/lib/email';
import { assembleFixPack } from '@/lib/fixpack';
import { loadScanView } from '@/lib/scan-data';

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

  // A Checkout Session this code created says what it is in metadata. A
  // payment link cannot: Stripe hosts that page and we never touch it, so the
  // only things that come back are the session's mode and whatever we hung on
  // `client_reference_id` when we sent the person there. Mode is the reliable
  // discriminator — the fix pack is a one-off payment, monitoring is a
  // subscription — and the reference is the scan or the site.
  const plan: Plan = session.metadata?.plan === 'monitor' || session.mode === 'subscription' ? 'monitor' : 'fixpack';
  const reference = session.client_reference_id ?? null;
  let scanId = session.metadata?.scanId ?? (plan === 'fixpack' ? reference : null);
  let domain = session.metadata?.domain ?? null;

  // Fill in what the link could not carry, so the email names the right site.
  if (!domain && reference) {
    domain = await domainFor(plan, reference);
  }
  if (plan === 'monitor') scanId = null;

  const outcome = await grantEntitlement(supabaseStore(serviceClient()), {
    eventId,
    email,
    plan,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
    currentPeriodEnd: plan === 'monitor' ? periodEndFor(session) : null,
  });

  // One line per purchase, so "did they get it?" is answerable from the logs
  // rather than from the buyer. No address and no session id: whether an email
  // was found is the fact worth keeping, not whose.
  console.info(
    `[stripe] checkout ${plan} granted=${outcome.granted} duplicate=${outcome.duplicate} scan=${scanId ?? 'none'} reference=${reference ?? 'none'} email=yes`,
  );

  if (outcome.granted && scanId) {
    // Best effort. A missing email is a support ticket; a failed webhook is a
    // retry that grants nothing and confuses everyone.
    // Build the pack here so the buyer gets the files in the message rather
    // than a link they may not be able to sign in behind. A failure to build
    // must not swallow the email: they paid, and a confirmation that never
    // arrives is worse than one without its attachment.
    const pack = await assembleForEmail(scanId);
    await sendFixpackReady({ to: email, scanId, domain, pack, sessionId: session.id })
      .then(() => console.info(`[stripe] fix pack email sent for scan ${scanId} (${pack ? pack.entries.length : 0} files)`))
      .catch((err) => {
        console.error('[stripe] fix pack email failed', err);
      });
  } else if (outcome.granted && plan === 'monitor') {
    // Monitoring used to send nothing at all: the fix pack email needs a scan
    // and this plan has none, so a subscriber's only confirmation was Stripe's
    // receipt. Paying every month and never hearing from us is the same
    // experience as paying for nothing.
    await sendMonitorStarted({ to: email, domain: domain ?? 'your site' })
      .then(() => console.info('[stripe] monitoring welcome sent'))
      .catch((err) => {
        console.error('[stripe] monitoring welcome failed', err);
      });
  } else if (outcome.granted) {
    // A fix pack whose payment link came back without the scan it was for.
    console.warn(`[stripe] ${plan} granted with no scan to send; reference=${reference ?? 'none'}`);
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

/**
 * The domain behind a `client_reference_id`: a scan id for the fix pack, a
 * site id for monitoring. Best effort — it only decorates the email.
 */
async function domainFor(plan: Plan, reference: string): Promise<string | null> {
  const supabase = serviceClient();
  if (plan === 'monitor') {
    const { data } = await supabase.from('sites').select('domain').eq('id', reference).maybeSingle();
    return (data as { domain: string } | null)?.domain ?? null;
  }
  const { data } = await supabase.from('scans').select('sites(domain)').eq('id', reference).maybeSingle();
  return (data as unknown as { sites: { domain: string } | null } | null)?.sites?.domain ?? null;
}

/** A month from checkout for a new subscription. The renewal invoice corrects it. */
function periodEndFor(session: Stripe.Checkout.Session): Date {
  const created = session.created ? new Date(session.created * 1000) : new Date();
  return new Date(created.getTime() + 31 * 24 * 3600 * 1000);
}

/**
 * The pack for the purchase email, or null. Never throws: every failure here
 * ends with the buyer getting an email that says the files are coming, which
 * is recoverable, rather than with no email at all, which is not.
 */
async function assembleForEmail(scanId: string) {
  try {
    const view = await loadScanView(scanId);
    return view ? assembleFixPack(view, scanId) : null;
  } catch (err) {
    console.error('[stripe] could not assemble the fix pack for', scanId, err);
    return null;
  }
}
