import { NextResponse, type NextRequest } from 'next/server';

import { InvalidUrlError, normaliseDomain, normaliseTargetUrl } from '@botready/core';

import { cacheScanId, cachedScanId, rateLimit } from '@/lib/redis';
import { createScan, latestScanForDomain, upsertSite } from '@/lib/scan-data';
import { enqueueScan } from '@/lib/queue';
import { currentUser } from '@/lib/auth';
import { LIMITS } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scan  { url } -> { scanId, cached }
 *
 * Three gates, in this order:
 *
 *   1. Is it a URL we are willing to consider? Shape only; whether the host is
 *      safe to connect to is the worker's decision, after DNS.
 *   2. Has this domain been scanned in the last 24 hours? If so, hand back that
 *      scan. This is what stops a link from the public index being turned into
 *      a hammer: many page views, one crawl.
 *   3. Is this caller inside their hourly allowance?
 *
 * The cache check comes before the rate limit deliberately. Following a link
 * from the index costs the caller nothing, because it costs the site being
 * measured nothing.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'Send a JSON body with a url in it.');
  }

  const raw = (body as { url?: unknown } | null)?.url;
  if (typeof raw !== 'string') {
    return problem(400, 'Send a JSON body with a url in it.');
  }

  let url: string;
  try {
    url = normaliseTargetUrl(raw);
  } catch (err) {
    if (err instanceof InvalidUrlError) return problem(400, err.message);
    throw err;
  }

  const domain = normaliseDomain(url);

  // ---------------------------------------------------------------- the cache

  const cached = await cachedScanId(domain);
  if (cached) {
    return NextResponse.json({ scanId: cached, cached: true, domain }, { status: 200 });
  }

  // Redis may be cold or absent; the database is the durable answer.
  const recent = await latestScanForDomain(domain);
  if (recent && withinCacheWindow(recent.finished_at ?? recent.created_at)) {
    await cacheScanId(domain, recent.id, LIMITS.cacheHours);
    return NextResponse.json({ scanId: recent.id, cached: true, domain }, { status: 200 });
  }

  // ---------------------------------------------------------------- the limit

  const user = await currentUser();
  const limit = user ? LIMITS.signedInScansPerHour : LIMITS.anonymousScansPerHour;
  const identity = user ? `user:${user.id}` : `ip:${callerIp(request)}`;
  const verdict = await rateLimit(identity, limit);

  if (!verdict.allowed) {
    const minutes = Math.max(1, Math.ceil(verdict.resetSeconds / 60));
    return problem(
      429,
      user
        ? `You have used all ${limit} scans in this hour. The allowance resets in ${minutes} ${plural(minutes, 'minute')}.`
        : `You have used all ${limit} scans in this hour. The allowance resets in ${minutes} ${plural(minutes, 'minute')}. Signing in raises it to ${LIMITS.signedInScansPerHour}.`,
      {
        'retry-after': String(verdict.resetSeconds),
        'x-ratelimit-limit': String(verdict.limit),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(verdict.resetSeconds),
      },
    );
  }

  // ---------------------------------------------------------------- the scan

  const siteId = await upsertSite(domain);
  const scanId = await createScan({ siteId, url, trigger: 'manual' });

  try {
    await enqueueScan({ scanId, url });
  } catch (err) {
    // The row exists and nothing will pick it up, so say so rather than
    // leaving the result page polling a scan that is never going to start.
    const { markScanErrored } = await import('@/lib/scan-data');
    const message = err instanceof Error ? err.message : String(err);
    await markScanErrored(scanId, `The scan could not be queued. ${message}`);
    return problem(
      503,
      'The scanner is not accepting work right now. Nothing was crawled. Try again in a minute.',
    );
  }

  // Cached the moment it is queued, not when it finishes, so a burst of
  // requests for one domain produces one crawl rather than a crawl each.
  await cacheScanId(domain, scanId, LIMITS.cacheHours);

  return NextResponse.json(
    { scanId, cached: false, domain },
    {
      status: 202,
      headers: {
        'x-ratelimit-limit': String(verdict.limit),
        'x-ratelimit-remaining': String(verdict.remaining),
      },
    },
  );
}

function withinCacheWindow(timestamp: string): boolean {
  const age = Date.now() - new Date(timestamp).getTime();
  return Number.isFinite(age) && age >= 0 && age < LIMITS.cacheHours * 3600 * 1000;
}

/**
 * The caller's address. Vercel puts the real client first in x-forwarded-for,
 * and everything after it is a proxy we do not control, so only the first entry
 * is used as an identity.
 */
function callerIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

function problem(status: number, error: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ error }, { status, headers: { ...headers, 'cache-control': 'no-store' } });
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
