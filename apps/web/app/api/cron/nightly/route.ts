import { NextResponse } from 'next/server';

import { scoreDetail, type CheckResult } from '@botready/core';

import { authoriseCron } from '@/lib/cron';
import { defaultKV } from '@/lib/kv';
import { enqueueScan } from '@/lib/queue';
import { rememberScan } from '@/lib/scan-gate';
import { createScan, persistScore } from '@/lib/scan-data';
import { LIMITS } from '@/lib/site';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/nightly — re-scan the index cohort.
 *
 * Up to COHORT sites, spread across an hour so the worker never holds more than
 * its concurrency cap: message i is delayed by i × SPREAD seconds and QStash
 * delivers it then. At a cap of 2 and thirty seconds a scan the worker drains
 * faster than the queue fills, so the window is set by the spread and not by
 * the worker, and the whole run finishes inside two hours whatever the worker
 * is doing.
 *
 * The cohort is the stalest sites first and is capped, because it is no longer
 * a fixed list: a site now joins the index the first time anyone scans it, so
 * "every site with a segment" grows without limit and would eventually ask for
 * a window longer than a night. Oldest-first means every site comes round, and
 * the ones nobody has looked at in longest come round first.
 *
 * Also sweeps for finished scans that have no score row yet and writes one,
 * which is what keeps the index view current if a result page was never opened.
 */
const SPREAD_SECONDS = 20;
const COHORT = 200;

export async function GET(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = serviceClient();

  // ---------------------------------------------------------------- the sweep

  const swept = await sweepUnscored();

  // ---------------------------------------------------------------- the cohort

  // index_rows is exactly "sites in the ranking, with their latest finished
  // scan", so it carries the staleness this needs to sort by. Reading it here
  // rather than `sites` also means the cron and the page can never disagree
  // about who is in the index.
  const { data: sites, error } = await supabase
    .from('index_rows')
    .select('site_id, domain, finished_at')
    .order('finished_at', { ascending: true, nullsFirst: true })
    .limit(COHORT);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const kv = defaultKV();
  const queued: string[] = [];
  const failed: Array<{ domain: string; error: string }> = [];

  for (const [i, site] of (sites ?? []).entries()) {
    const domain = String(site.domain);
    const url = `https://${domain}/`;
    try {
      const scanId = await createScan({ siteId: String(site.site_id), url, trigger: 'index' });
      // The cache now points at tonight's scan, so a click from the index page
      // tomorrow lands on the fresh result rather than yesterday's.
      await rememberScan(domain, scanId, LIMITS.cacheHours, kv);
      await enqueueScan({ scanId, url }, { delaySeconds: i * SPREAD_SECONDS });
      queued.push(domain);
    } catch (err) {
      failed.push({ domain, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    queued: queued.length,
    cohort: COHORT,
    oldestFirst: sites?.[0]?.domain ?? null,
    failed,
    scoresWritten: swept,
    windowMinutes: Math.ceil(((sites?.length ?? 0) * SPREAD_SECONDS) / 60),
  });
}

/** Finished scans with evidence but no score row. */
async function sweepUnscored(): Promise<number> {
  const supabase = serviceClient();

  // Scans complete in the last two days, so a long-lived backlog is handled a
  // night at a time rather than in one call that times out.
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const { data: scans } = await supabase
    .from('scans')
    .select('id, scores(id)')
    .eq('status', 'complete')
    .gte('finished_at', since)
    .limit(500);

  let written = 0;
  for (const scan of scans ?? []) {
    const row = scan as { id: string; scores: Array<{ id: string }> | null };
    if (row.scores && row.scores.length > 0) continue;

    const { data: evidence } = await supabase
      .from('evidence')
      .select('check_key, status, observed, duration_ms')
      .eq('scan_id', row.id);

    const results: CheckResult[] = (evidence ?? []).map((e) => ({
      key: String(e.check_key),
      status: e.status as CheckResult['status'],
      observed: (e.observed ?? {}) as Record<string, unknown>,
      durationMs: Number(e.duration_ms ?? 0),
    }));

    if (results.length === 0) continue;
    // scoreDetail is what persistScore runs; called here only so a scan with
    // evidence that cannot be scored is skipped rather than half-written.
    scoreDetail(results);
    await persistScore(row.id, results);
    written += 1;
  }
  return written;
}
