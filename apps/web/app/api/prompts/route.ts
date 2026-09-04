import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROMPTS = 12;
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
  const { count } = await supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('is_active', true);
  if ((count ?? 0) >= MAX_PROMPTS) return problem(409, `Up to ${MAX_PROMPTS} prompts per domain. Remove one first.`);

  const { data, error } = await supabase
    .from('prompts')
    .upsert({ site_id: siteId, text, created_by: user.id, is_active: true }, { onConflict: 'site_id,text' })
    .select('id')
    .single();
  if (error || !data) return problem(500, error?.message ?? 'Could not save the prompt.');
  return NextResponse.json({ ok: true, id: (data as { id: string }).id, text });
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
