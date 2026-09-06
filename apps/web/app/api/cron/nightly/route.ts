import { NextResponse } from 'next/server';

import { authoriseCron } from '@/lib/cron';
import { defaultKV } from '@/lib/kv';
import { enqueueScan } from '@/lib/queue';
import { rememberScan } from '@/lib/scan-gate';
import { createScan } from '@/lib/scan-data';
import { LIMITS } from '@/lib/site';
import { sweepUnscored } from '@/lib/sweep';
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
 * Sweeps for finished scans with no score row before it starts, which clears
 * anything left behind since the last run. It cannot clear the scans it is
 * about to start — those settle minutes after this function returns — so
 * /api/cron/sweep runs half an hour later and catches them. See lib/sweep.ts.
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
