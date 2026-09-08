import { NextResponse } from 'next/server';

import { authoriseCron } from '@/lib/cron';
import { reapStuckScans } from '@/lib/reaper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/reap — hourly.
 *
 * Settles scans the worker started and never finished. `/api/scan/[id]` does
 * this for the one scan somebody is watching, which is every scan a person
 * cares about and none of the ones the index cron starts. Those have no
 * audience, so before this they sat at `running` indefinitely.
 *
 * Hourly rather than nightly because the number it fixes is one somebody reads
 * off a dashboard, and a stuck scan that clears within the hour is noise while
 * one that sits for a day is a bug report. Cheap either way: after a clean
 * hour it settles nothing.
 */
export async function GET(request: Request) {
  const auth = authoriseCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const reaped = await reapStuckScans();
  return NextResponse.json({ ok: true, reaped: reaped.length, scans: reaped });
}
