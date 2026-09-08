import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { mintIngestKey } from '@/lib/crawler-data';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest-key { siteId } -> a new write token, shown once.
 *
 * Only for a site this person has claimed, because the token it returns lets
 * whoever holds it write into that site's analytics. Minting a second one
 * revokes the first: two live keys for one drain is a state the interface has
 * no way to explain, and a customer who thinks they rotated a key needs the
 * old one to actually stop working.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  if (!siteId) return NextResponse.json({ error: 'Which site?' }, { status: 400 });

  const { data } = await serviceClient().from('sites').select('claimed_by').eq('id', siteId).maybeSingle();
  if ((data as { claimed_by: string | null } | null)?.claimed_by !== user.id) {
    return NextResponse.json({ error: 'That is not one of your domains.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, token: await mintIngestKey(siteId, user.id) });
}
