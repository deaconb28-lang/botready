import { NextResponse } from 'next/server';

import { InvalidUrlError, normaliseDomain } from '@botready/core';

import { currentUser } from '@/lib/auth';
import { defaultKV } from '@/lib/kv';
import { enqueueScan } from '@/lib/queue';
import { cachedScanId } from '@/lib/redis';
import { createScan, upsertSite } from '@/lib/scan-data';
import { rememberScan } from '@/lib/scan-gate';
import { LIMITS } from '@/lib/site';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMPETITORS = 6;

/**
 * POST /api/competitors { siteId, domain }  -> add a competitor and scan it
 * DELETE /api/competitors { siteId, domain } -> remove it
 *
 * Only the owner of a claimed site. The competitor goes through the same
 * pipeline as everything else: a site row, a scan, the worker. Its result is
 * public like every result.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in first.');
  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; domain?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const owned = await ownedSite(siteId, user.id);
  if (!owned) return problem(403, 'That is not one of your domains.');

  let domain: string;
  try {
    domain = normaliseDomain(String(body.domain ?? ''));
    if (!domain.includes('.')) throw new InvalidUrlError('not a domain');
  } catch {
    return problem(400, `${String(body.domain ?? '')} is not a domain.`);
  }
  if (domain === owned.domain) return problem(400, 'That is your own domain.');

  const supabase = serviceClient();
  const { count } = await supabase.from('competitors').select('id', { count: 'exact', head: true }).eq('site_id', siteId);
  if ((count ?? 0) >= MAX_COMPETITORS) return problem(409, `Up to ${MAX_COMPETITORS} competitors per domain. Remove one first.`);

  const competitorSiteId = await upsertSite(domain);
  const { error } = await supabase
    .from('competitors')
    .upsert({ site_id: siteId, competitor_site_id: competitorSiteId, added_by: user.id }, { onConflict: 'site_id,competitor_site_id' });
  if (error) return problem(500, error.message);

  // Scan it unless a fresh result already exists.
  const kv = defaultKV();
  const cached = await cachedScanId(domain, kv);
  let scanId = cached;
  if (!cached) {
    const url = `https://${domain}/`;
    scanId = await createScan({ siteId: competitorSiteId, url, trigger: 'competitor' });
    await rememberScan(domain, scanId, LIMITS.cacheHours, kv);
    try {
      await enqueueScan({ scanId, url });
    } catch (err) {
      return NextResponse.json({ ok: true, domain, scanId, queued: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, domain, scanId, queued: !cached });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return problem(401, 'Sign in first.');
  const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; domain?: unknown };
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  if (!(await ownedSite(siteId, user.id))) return problem(403, 'That is not one of your domains.');
  const domain = typeof body.domain === 'string' ? body.domain : '';

  const supabase = serviceClient();
  const { data: site } = await supabase.from('sites').select('id').eq('domain', domain).maybeSingle();
  if (!site) return NextResponse.json({ ok: true });
  await supabase.from('competitors').delete().eq('site_id', siteId).eq('competitor_site_id', (site as { id: string }).id);
  return NextResponse.json({ ok: true });
}

async function ownedSite(siteId: string, userId: string): Promise<{ id: string; domain: string } | null> {
  if (!siteId) return null;
  const { data } = await serviceClient().from('sites').select('id, domain, claimed_by').eq('id', siteId).maybeSingle();
  const row = data as { id: string; domain: string; claimed_by: string | null } | null;
  return row && row.claimed_by === userId ? { id: row.id, domain: row.domain } : null;
}

function problem(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
