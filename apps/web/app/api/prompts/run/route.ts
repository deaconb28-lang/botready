import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { probeConfigured } from '@/lib/prompt-probe';
import { runPromptsForSite } from '@/lib/prompts';
import { rateLimit } from '@/lib/redis';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/prompts/run { siteId } -> ask every watched prompt now.
 *
 * The weekly cron does this on its own; this is the button. Limited to a few
 * runs an hour per person, because each prompt is a model call with web search.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!probeConfigured()) {
    return NextResponse.json({ error: 'Prompt watch is not configured on this deployment. ANTHROPIC_API_KEY is not set.' }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const { data } = await serviceClient().from('sites').select('domain, claimed_by').eq('id', siteId).maybeSingle();
  const site = data as { domain: string; claimed_by: string | null } | null;
  if (!site || site.claimed_by !== user.id) return NextResponse.json({ error: 'That is not one of your domains.' }, { status: 403 });

  const verdict = await rateLimit(`prompts:${user.id}`, 4);
  if (!verdict.allowed) {
    return NextResponse.json({ error: 'Prompts were already asked recently. Try again in an hour.' }, { status: 429, headers: { 'retry-after': String(verdict.resetSeconds) } });
  }

  const summary = await runPromptsForSite(siteId, site.domain);
  return NextResponse.json({ ok: true, ...summary });
}
