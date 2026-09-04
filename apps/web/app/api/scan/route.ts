import { NextResponse, type NextRequest } from 'next/server';

import { InvalidUrlError, normaliseDomain, normaliseTargetUrl } from '@botready/core';

import { currentUser } from '@/lib/auth';
import { defaultKV } from '@/lib/kv';
import { enqueueScan } from '@/lib/queue';
import { admitScan, limitedMessage, rememberScan } from '@/lib/scan-gate';
import { createScan, latestScanForDomain, markScanErrored, upsertSite } from '@/lib/scan-data';
import { LIMITS } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scan  { url } -> { scanId, cached }
 *
 * The shape check happens here; whether the host is safe to connect to is the
 * worker's decision, after DNS. Everything about whether to crawl at all is in
 * lib/scan-gate.ts, where it can be tested.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'Send a JSON body with a url in it.');
  }

  const raw = (body as { url?: unknown } | null)?.url;
  if (typeof raw !== 'string') return problem(400, 'Send a JSON body with a url in it.');

  let url: string;
  try {
    url = normaliseTargetUrl(raw);
  } catch (err) {
    if (err instanceof InvalidUrlError) return problem(400, err.message);
    throw err;
  }

  const domain = normaliseDomain(url);
  const user = await currentUser();
  const limit = user ? LIMITS.signedInScansPerHour : LIMITS.anonymousScansPerHour;
  const kv = defaultKV();

  const admission = await admitScan({
    domain,
    identity: user ? `user:${user.id}` : `ip:${callerIp(request)}`,
    limit,
    cacheHours: LIMITS.cacheHours,
    kv,
    findRecent: async (d) => {
      const recent = await latestScanForDomain(d);
      return recent ? { id: recent.id, finishedAt: recent.finished_at ?? recent.created_at } : null;
    },
  });

  if (admission.kind === 'cached') {
    return NextResponse.json({ scanId: admission.scanId, cached: true, domain });
  }

  if (admission.kind === 'limited') {
    const { verdict } = admission;
    return problem(429, limitedMessage(verdict, Boolean(user), LIMITS.signedInScansPerHour), {
      'retry-after': String(verdict.resetSeconds),
      'x-ratelimit-limit': String(verdict.limit),
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(verdict.resetSeconds),
    });
  }

  const siteId = await upsertSite(domain);
  const scanId = await createScan({ siteId, url, trigger: 'manual' });

  // Remembered before it is queued, so a burst for one domain crawls once.
  await rememberScan(domain, scanId, LIMITS.cacheHours, kv);

  try {
    await enqueueScan({ scanId, url });
  } catch (err) {
    // The row exists and nothing will pick it up. Say so, and drop the cache
    // entry so the next attempt crawls rather than being handed this failure.
    // Logged as well as recorded on the row, so the platform logs name the
    // cause without a trip to the database.
    console.error('scan could not be queued', { scanId, err: err instanceof Error ? err.message : String(err) });
    const { forgetCachedScan } = await import('@/lib/redis');
    await forgetCachedScan(domain, kv);
    await markScanErrored(
      scanId,
      `The scan could not be queued. ${err instanceof Error ? err.message : String(err)}`,
    );
    return problem(
      503,
      'The scanner is not accepting work right now. Nothing was crawled. Try again in a minute.',
    );
  }

  return NextResponse.json(
    { scanId, cached: false, domain },
    {
      status: 202,
      headers: {
        'x-ratelimit-limit': String(admission.verdict.limit),
        'x-ratelimit-remaining': String(admission.verdict.remaining),
      },
    },
  );
}

/**
 * The caller's address. Vercel puts the real client first in x-forwarded-for
 * and everything after it is a proxy we do not control, so only the first entry
 * is an identity.
 */
function callerIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

function problem(status: number, error: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { error },
    { status, headers: { ...headers, 'cache-control': 'no-store' } },
  );
}
