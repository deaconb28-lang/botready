import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { absoluteUrl } from '@/lib/site';
import { stripe } from '@/lib/stripe';
import { publicClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/monitor/:siteId -> 303 to Stripe Checkout, subscription mode.
 *
 * Only for a site this person has claimed. The webhook's `checkout.session.completed`
 * grants the first period and `invoice.paid` extends it.
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

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: serverEnv.stripePriceMonitor(), quantity: 1 }],
    customer_email: user.email,
    metadata: { plan: 'monitor', siteId, domain: row.domain },
    subscription_data: { metadata: { plan: 'monitor', siteId, domain: row.domain } },
    success_url: absoluteUrl(`/claim/${row.domain}?subscribed=1`),
    cancel_url: absoluteUrl(`/claim/${row.domain}`),
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL. Nothing was charged.' }, { status: 502 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
