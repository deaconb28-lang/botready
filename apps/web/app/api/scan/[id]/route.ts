import { NextResponse } from 'next/server';

import type { PerAgentFetch } from '@botready/core';

import { isStuck } from '@/lib/scan-gate';
import { loadScanView, markScanErrored, persistScore } from '@/lib/scan-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/scan/:id
 *
 * The polling endpoint behind /scan/live, and the summary the result page uses
 * to hydrate. Public, because scan results are public by design: that is the
 * distribution model.
 *
 * The score is computed on read from the evidence rows rather than served from
 * the `scores` table, so this response can never disagree with the facts under
 * it.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'That is not a scan id.' }, { status: 400 });
  }

  const view = await loadScanView(id);
  if (!view) {
    return NextResponse.json({ error: 'No scan with that id.' }, { status: 404 });
  }

  const { scan, site, score } = view;

  // A scan that has outlived any possible run is settled here, because nothing
  // else will settle it. The worker is the only thing that marks a scan
  // finished, and a worker that restarted mid-scan is by definition not going
  // to come back and do it — the row sits at `running` and the live page polls
  // it forever, which is what somebody experiences as "it has taken five
  // minutes". This route is polled every second by that page, so it is the one
  // place guaranteed to be looking at exactly the moment it matters.
  let status = scan.status;
  if (isStuck(status, scan.started_at, scan.created_at)) {
    status = 'error';
    await markScanErrored(
      scan.id,
      'The scan stopped before it finished, which is our problem and not the site\'s. Nothing was measured. Run it again.',
    ).catch(() => {});
    // And forget the cached id, or the 24-hour window hands the next person
    // this same dead scan instead of crawling.
    const { forgetCachedScan } = await import('@/lib/redis');
    const { defaultKV } = await import('@/lib/kv');
    await forgetCachedScan(site.domain, defaultKV()).catch(() => {});
  }

  const settled = status === 'complete' || status === 'blocked' || status === 'error';

  // The first read of a finished scan writes its score row. Idempotent on
  // (scan_id, scoring_version), cheap, and it is what keeps the index view
  // current without waiting for the nightly sweep.
  if (scan.status === 'complete' && score) {
    await persistScore(scan.id, view.results).catch(() => {});
  }

  return NextResponse.json(
    {
      scanId: scan.id,
      domain: site.domain,
      url: scan.url,
      status,
      settled,
      scannerVersion: scan.scanner_version,
      pagesCrawled: scan.pages_crawled,
      errorMessage:
        status === 'error' && !scan.error_message
          ? 'The scan stopped before it finished, which is our problem and not the site\'s. Nothing was measured. Run it again.'
          : scan.error_message,
      startedAt: scan.started_at,
      finishedAt: scan.finished_at,
      checksComplete: view.results.length,
      score: score
        ? {
            total: score.total,
            grade: score.grade,
            scoringVersion: score.scoringVersion,
            categoryScores: score.categoryScores,
            failedChecks: score.failedChecks,
            erroredChecks: score.erroredChecks,
            skippedChecks: score.skippedChecks,
          }
        : null,
      // Enough for the live log to show real requests with real status codes.
      // The full evidence is on the page itself rather than in the poll.
      progress: view.results.map((r) => ({ key: r.key, status: r.status })),
      // The headline comparison, as soon as it exists. /scan/live shows the
      // five clients resolving to their real status codes the moment the
      // parity check lands, which is the whole finding and the reason anyone
      // watches a scan at all. Null until then, and never a placeholder
      // status: a fabricated 200 that later turned into a 403 would be a lie
      // told by the loading screen.
      clients: clientsOf(view.results),
    },
    {
      status: 200,
      headers: settled
        ? // A finished scan never changes, so it can be cached hard. This is
          // most of what makes a link from the index cheap to serve.
          { 'cache-control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400' }
        : { 'cache-control': 'no-store' },
    },
  );
}

/**
 * The parity check's own observation, passed through unchanged. Null until the
 * check has landed, and null for a scan that never got that far.
 */
function clientsOf(
  results: Array<{ key: string; observed: Record<string, unknown> }>,
): { control: string; perAgent: Record<string, PerAgentFetch> } | null {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  if (!parity) return null;
  const perAgent = (parity.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  if (Object.keys(perAgent).length === 0) return null;
  return { control: String(parity.observed.control ?? 'chrome'), perAgent };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
