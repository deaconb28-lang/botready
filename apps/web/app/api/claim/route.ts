import { NextResponse } from 'next/server';

import { InvalidUrlError, normaliseDomain } from '@botready/core';

import { currentUser } from '@/lib/auth';
import { instructions, verifyClaim } from '@/lib/claims';
import { publicClient, serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/claim  { domain }           -> the token and where to put it
 * PUT  /api/claim  { domain }           -> check for it, and claim on success
 *
 * Signed in only: a claim belongs to a person. And only for a domain already in
 * `sites`, which means the worker has already reached it through the guarded
 * fetcher — see the note in lib/claims.ts for why that matters.
 *
 * On success the claim drops straight into the monitor subscription: a
 * monitor row is created for the site, and the response says where to pay for
 * it. The row does nothing until the monitor entitlement exists.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in to claim a domain.');

  const domain = await domainFrom(request);
  if (typeof domain !== 'string') return domain;

  const site = await siteFor(domain);
  if (!site) {
    return problem(
      404,
      `${domain} has not been scanned yet. Run a check on it first; a claim is only possible for a site we have already measured.`,
    );
  }

  return NextResponse.json({ ...instructions(user.id, domain), alreadyClaimed: site.is_claimed });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in to claim a domain.');

  const domain = await domainFrom(request);
  if (typeof domain !== 'string') return domain;

  const site = await siteFor(domain);
  if (!site) return problem(404, `${domain} has not been scanned yet.`);

  const verification = await verifyClaim(user.id, domain);
  if (!verification.verified) {
    return NextResponse.json({ verified: false, reason: verification.reason }, { status: 422 });
  }

  const supabase = serviceClient();
  await supabase.from('claims').upsert(
    { site_id: site.id, user_id: user.id, method: verification.method },
    { onConflict: 'site_id,user_id' },
  );
  await supabase
    .from('sites')
    .update({ is_claimed: true, claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq('id', site.id);

  // Straight into the subscription. The monitor exists from this moment and
  // starts scanning the moment the entitlement does.
  await supabase
    .from('monitors')
    .upsert({ user_id: user.id, site_id: site.id, cadence: 'weekly' }, { onConflict: 'user_id,site_id' });

  return NextResponse.json({
    verified: true,
    method: verification.method,
    domain,
    next: `/api/checkout/monitor/${site.id}`,
  });
}

async function domainFrom(request: Request): Promise<string | NextResponse> {
  let body: { domain?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return problem(400, 'Send a JSON body with a domain in it.');
  }
  if (typeof body.domain !== 'string' || !body.domain.trim()) {
    return problem(400, 'Send a JSON body with a domain in it.');
  }
  try {
    const domain = normaliseDomain(body.domain);
    if (!domain.includes('.')) throw new InvalidUrlError('not a domain');
    return domain;
  } catch {
    return problem(400, `${body.domain} is not a domain.`);
  }
}

async function siteFor(domain: string): Promise<{ id: string; is_claimed: boolean } | null> {
  const { data } = await publicClient().from('sites').select('id, is_claimed').eq('domain', domain).maybeSingle();
  return (data as { id: string; is_claimed: boolean } | null) ?? null;
}

function problem(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
