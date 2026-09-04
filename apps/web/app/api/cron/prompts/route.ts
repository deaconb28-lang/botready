import { NextResponse } from 'next/server';

import { authoriseCron } from '@/lib/cron';
import { probeConfigured } from '@/lib/prompt-probe';
import { runPromptsForSite } from '@/lib/prompts';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/prompts — weekly.
 *
 * Asks every active prompt for every claimed site whose owner holds a live
 * monitor entitlement, and records the answers. Sites on the free plan keep
 * their prompts and can run them by hand from the app.
 */
export async function GET(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!probeConfigured()) return NextResponse.json({ skipped: 'ANTHROPIC_API_KEY is not set' });

  const supabase = serviceClient();
  const { data: prompts } = await supabase.from('prompts').select('site_id, sites(domain, claimed_by)').eq('is_active', true);
  const sites = new Map<string, { domain: string; owner: string }>();
  for (const raw of prompts ?? []) {
    const row = raw as unknown as { site_id: string; sites: { domain: string; claimed_by: string | null } | null };
    if (row.sites?.claimed_by) sites.set(row.site_id, { domain: row.sites.domain, owner: row.sites.claimed_by });
  }

  const out: Record<string, unknown> = {};
  for (const [siteId, site] of sites) {
    if (!(await hasLiveMonitor(site.owner))) {
      out[site.domain] = 'skipped: no monitor plan';
      continue;
    }
    out[site.domain] = await runPromptsForSite(siteId, site.domain);
  }
  return NextResponse.json({ sites: out });
}

async function hasLiveMonitor(userId: string): Promise<boolean> {
  const { data } = await serviceClient().from('entitlements').select('current_period_end').eq('user_id', userId).eq('plan', 'monitor');
  return (data ?? []).some((row) => {
    const end = (row as { current_period_end: string | null }).current_period_end;
    return end !== null && new Date(end).getTime() > Date.now();
  });
}
