import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/monitor  { siteId, cadence? }   -> create or update a monitor
 * DELETE /api/monitor { siteId }             -> switch it off
 *
 * Only for a site this person has claimed. The row is inert until a monitor
 * entitlement exists; /api/cron/monitors checks on every run.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; cadence?: unknown };
  if (typeof body.siteId !== 'string') return NextResponse.json({ error: 'siteId is required.' }, { status: 400 });
  const cadence = body.cadence === 'daily' ? 'daily' : 'weekly';

  const supabase = serviceClient();
  const { data: site } = await supabase.from('sites').select('claimed_by').eq('id', body.siteId).maybeSingle();
  if ((site as { claimed_by: string | null } | null)?.claimed_by !== user.id) {
    return NextResponse.json({ error: 'Claim the site first.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('monitors')
    .upsert({ user_id: user.id, site_id: body.siteId, cadence, is_active: true }, { onConflict: 'user_id,site_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cadence });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown };
  if (typeof body.siteId !== 'string') return NextResponse.json({ error: 'siteId is required.' }, { status: 400 });

  await serviceClient()
    .from('monitors')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('site_id', body.siteId);

  return NextResponse.json({ ok: true });
}
