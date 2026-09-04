import { NextResponse } from 'next/server';

import { planFor } from '@/lib/account-data';
import { currentUser } from '@/lib/auth';
import { portalUrl } from '@/lib/billing';
import { absoluteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/portal -> 303 to the Stripe customer portal.
 *
 * Card changes, invoices and cancellation all happen there. A person with no
 * Stripe customer yet is sent to the pricing page instead.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(absoluteUrl('/sign-in?next=/account/billing'), 303);
  const plan = await planFor(user.id);
  if (!plan.stripeCustomerId) return NextResponse.redirect(absoluteUrl('/pricing'), 303);
  try {
    return NextResponse.redirect(await portalUrl(plan.stripeCustomerId), 303);
  } catch (err) {
    return NextResponse.json({ error: `Stripe could not open the billing portal: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }
}
