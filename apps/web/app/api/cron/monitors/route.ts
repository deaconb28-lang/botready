import { NextResponse } from 'next/server';

import type { CategoryKey, CheckResult } from '@botready/core';

import { authoriseCron } from '@/lib/cron';
import { sendMonitorAlert } from '@/lib/email';
import { defaultKV } from '@/lib/kv';
import { alertCopy, diff, shouldAlert, type ScanSnapshot } from '@/lib/monitor-diff';
import { enqueueScan } from '@/lib/queue';
import { rememberScan } from '@/lib/scan-gate';
import { createScan, persistScore } from '@/lib/scan-data';
import { LIMITS } from '@/lib/site';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/monitors — weekly.
 *
 * Two jobs, in this order:
 *
 *   1. Settle last week. For every active monitor, compare its two most recent
 *      finished monitor scans. If a category dropped or a client that could
 *      read the site cannot now, write an alert row and send the email. This
 *      runs first because last week's scans finished long after last week's
 *      cron returned.
 *   2. Queue this week. One scan per due monitor, spread like the nightly run.
 *
 * A monitor runs only while its owner holds a live monitor entitlement. A
 * lapsed subscription stops the scans; the rows stay, so resubscribing picks
 * up where it left off.
 */
const SPREAD_SECONDS = 20;

export async function GET(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = serviceClient();

  const { data: monitors, error } = await supabase
    .from('monitors')
    .select('id, user_id, site_id, cadence, next_run_at, sites(domain), entitlements:user_id(plan, current_period_end)')
    .eq('is_active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alerts: string[] = [];
  const queued: string[] = [];
  const skipped: string[] = [];

  for (const [i, raw] of (monitors ?? []).entries()) {
    const monitor = raw as unknown as {
      id: string;
      user_id: string;
      site_id: string;
      cadence: string;
      next_run_at: string;
      sites: { domain: string } | null;
    };
    const domain = monitor.sites?.domain;
    if (!domain) continue;

    if (!(await hasLiveMonitorEntitlement(monitor.user_id))) {
      skipped.push(domain);
      continue;
    }

    // 1. settle
    const settled = await settle(monitor.id, monitor.site_id, monitor.user_id, domain);
    if (settled) alerts.push(domain);

    // 2. queue, if due
    if (new Date(monitor.next_run_at).getTime() > Date.now()) continue;

    const url = `https://${domain}/`;
    const scanId = await createScan({ siteId: monitor.site_id, url, trigger: 'monitor' });
    await rememberScan(domain, scanId, LIMITS.cacheHours, defaultKV());
    await enqueueScan({ scanId, url }, { delaySeconds: i * SPREAD_SECONDS });

    const next = new Date(Date.now() + (monitor.cadence === 'daily' ? 1 : 7) * 24 * 3600 * 1000);
    await supabase
      .from('monitors')
      .update({ last_run_at: new Date().toISOString(), next_run_at: next.toISOString() })
      .eq('id', monitor.id);
    queued.push(domain);
  }

  return NextResponse.json({ queued: queued.length, alerts, skippedNoEntitlement: skipped });
}

async function hasLiveMonitorEntitlement(userId: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from('entitlements')
    .select('plan, current_period_end')
    .eq('user_id', userId)
    .eq('plan', 'monitor');
  return (data ?? []).some((row) => {
    const end = (row as { current_period_end: string | null }).current_period_end;
    return end !== null && new Date(end).getTime() > Date.now();
  });
}

/**
 * Compare the two most recent finished monitor scans for a site and alert on a
 * drop. Returns true when an alert was written. Idempotent: an alert already
 * recorded against the newer scan is not written twice.
 */
async function settle(monitorId: string, siteId: string, userId: string, domain: string): Promise<boolean> {
  const supabase = serviceClient();

  const { data: scans } = await supabase
    .from('scans')
    .select('id, finished_at')
    .eq('site_id', siteId)
    .eq('status', 'complete')
    .in('trigger', ['monitor', 'index', 'manual'])
    .order('finished_at', { ascending: false })
    .limit(2);

  const [latest, previous] = (scans ?? []) as Array<{ id: string; finished_at: string }>;
  if (!latest || !previous) return false;

  const { data: existing } = await supabase
    .from('alerts')
    .select('id')
    .eq('monitor_id', monitorId)
    .eq('scan_id', latest.id)
    .maybeSingle();
  if (existing) return false;

  const [a, b] = await Promise.all([snapshot(previous.id, previous.finished_at), snapshot(latest.id, latest.finished_at)]);
  if (!a || !b) return false;

  const delta = diff(a, b);
  if (!shouldAlert(delta)) return false;

  const copy = alertCopy(domain, delta, latest.finished_at);

  await supabase.from('alerts').insert({
    monitor_id: monitorId,
    scan_id: latest.id,
    delta: {
      total: delta.total,
      category: delta.categoryDrops[0]?.category ?? null,
      newly_failed: delta.newlyFailed,
      newly_refused: delta.newlyRefused,
    },
  });

  const { data: user } = await supabase.auth.admin.getUserById(userId);
  const email = user.user?.email;
  if (email) {
    await sendMonitorAlert({ to: email, domain, scanId: latest.id, ...copy }).catch(() => {});
    await supabase.from('alerts').update({ sent_at: new Date().toISOString() }).eq('scan_id', latest.id).eq('monitor_id', monitorId);
  }
  return true;
}

async function snapshot(scanId: string, finishedAt: string): Promise<ScanSnapshot | null> {
  const supabase = serviceClient();
  const { data: evidence } = await supabase
    .from('evidence')
    .select('check_key, status, observed, duration_ms')
    .eq('scan_id', scanId);

  const results: CheckResult[] = (evidence ?? []).map((e) => ({
    key: String(e.check_key),
    status: e.status as CheckResult['status'],
    observed: (e.observed ?? {}) as Record<string, unknown>,
    durationMs: Number(e.duration_ms ?? 0),
  }));
  if (results.length === 0) return null;

  // Make sure the score row exists for the index, then read the arithmetic
  // the same way the result page does.
  await persistScore(scanId, results);
  const { scoreDetail } = await import('@botready/core');
  const detail = scoreDetail(results);

  return {
    scanId,
    total: detail.total,
    categoryScores: detail.categoryScores as Record<CategoryKey, number>,
    results,
    finishedAt,
  };
}
