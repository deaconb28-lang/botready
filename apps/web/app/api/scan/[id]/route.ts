import { NextResponse } from 'next/server';

import { loadScanView, persistScore } from '@/lib/scan-data';

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
  const settled = scan.status === 'complete' || scan.status === 'blocked' || scan.status === 'error';

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
      status: scan.status,
      settled,
      scannerVersion: scan.scanner_version,
      pagesCrawled: scan.pages_crawled,
      errorMessage: scan.error_message,
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
