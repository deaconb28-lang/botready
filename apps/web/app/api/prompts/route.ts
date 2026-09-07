import { NextResponse } from 'next/server';

import { planFor } from '@/lib/account-data';
import { currentUser } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LENGTH = 200;

/**
 * POST /api/prompts { siteId, text }   -> watch a prompt
 * DELETE /api/prompts { siteId, id }   -> stop watching it
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in first.');
  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; text?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  if (!(await owns(siteId, user.id))) return problem(403, 'That is not one of your domains.');

  const text = typeof body.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : '';
  if (text.length < 8) return problem(400, 'Write the question the way a buyer would ask it, at least a few words.');
  if (text.length > MAX_LENGTH) return problem(400, `Keep a prompt under ${MAX_LENGTH} characters.`);

  const supabase = serviceClient();
  const room = await allowance(user.id, siteId);
  if (room.used >= room.limit) return problem(409, room.message);

  const { data, error } = await supabase
    .from('prompts')
    .upsert({ site_id: siteId, text, created_by: user.id, is_active: true }, { onConflict: 'site_id,text' })
    .select('id')
    .single();
  if (error || !data) return problem(500, error?.message ?? 'Could not save the prompt.');
  return NextResponse.json({ ok: true, id: (data as { id: string }).id, text });
}

/**
 * How many more questions this person may watch, and where the ceiling is.
 *
 * Two shapes, because the plans are two shapes. Monitoring is bought for a
 * domain and its allowance is per domain. The agency plan is bought for an
 * account and its allowance is pooled across every domain on it — a client
 * whose category needs twenty questions should be able to have them, paid for
 * out of the ones a quieter client is not using.
 *
 * Pooled counting is a query over the sites this person has claimed rather
 * than over every site in the table: an agency's allowance is theirs, and a
 * prompt somebody else wrote must not eat into it.
 */
async function allowance(userId: string, siteId: string): Promise<{ used: number; limit: number; message: string }> {
  const supabase = serviceClient();
  const plan = await planFor(userId);
  const limit = plan.limits.prompts;

  if (plan.plan !== 'agency') {
    const { count } = await supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('is_active', true);
    return { used: count ?? 0, limit, message: `Up to ${limit} questions per domain. Remove one first.` };
  }

  const { data: mine } = await supabase.from('sites').select('id').eq('claimed_by', userId);
  const ids = (mine ?? []).map((row) => (row as { id: string }).id);
  const { count } = await supabase.from('prompts').select('id', { count: 'exact', head: true }).in('site_id', ids).eq('is_active', true);
  return {
    used: count ?? 0,
    limit,
    message: `Up to ${limit} questions across every domain on the agency plan. Remove one first.`,
  };
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in first.');
  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; id?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  if (!(await owns(siteId, user.id))) return problem(403, 'That is not one of your domains.');
  const id = typeof body.id === 'string' ? body.id : '';
  await serviceClient().from('prompts').update({ is_active: false }).eq('id', id).eq('site_id', siteId);
  return NextResponse.json({ ok: true });
}

async function owns(siteId: string, userId: string): Promise<boolean> {
  if (!siteId) return false;
  const { data } = await serviceClient().from('sites').select('claimed_by').eq('id', siteId).maybeSingle();
  return (data as { claimed_by: string | null } | null)?.claimed_by === userId;
}

function problem(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
