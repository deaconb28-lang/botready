import { NextResponse } from 'next/server';

import { authoriseCron } from '@/lib/cron';
import { sweepUnscored } from '@/lib/sweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/sweep — score the scans the nightly run just finished.
 *
 * The nightly cron sweeps and then enqueues, and its scans settle minutes
 * after it returns, so it can never score its own work. Left at that, a scan
 * the cron started waited a full day for a score, and for almost all of that
 * day the chart reported a site we had read perfectly well as one we could
 * not read. This runs half an hour behind it, by which time every scan of that
 * run has settled.
 *
 * Idempotent and cheap: it looks for finished scans with no score, and after
 * a clean night there are none.
 */
export async function GET(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({ ok: true, scored: await sweepUnscored() });
}
