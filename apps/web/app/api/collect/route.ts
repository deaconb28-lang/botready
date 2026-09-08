import { NextResponse } from 'next/server';

import { collect, parseBatch, siteForToken } from '@/lib/collect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/collect — a customer's log drain, or a file they uploaded.
 *
 * Node runtime and not the edge, deliberately: verification is a reverse DNS
 * lookup and a forward one, and `node:dns` is the reason this cannot run
 * anywhere cheaper.
 *
 * Authenticated by a per-site token in `x-botready-key`, compared by hash.
 * Not a signed-in session, because the thing calling this is a log drain with
 * no person behind it, and not a shared secret, because a token that leaks has
 * to be revocable for one customer rather than for everybody.
 *
 * Returns what it counted. A drain that gets a 200 and a summary can be
 * checked; one that gets a bare 200 cannot, and the first question anybody
 * asks after wiring this up is whether it is working.
 */
export async function POST(request: Request) {
  const token = request.headers.get('x-botready-key') ?? '';
  const siteId = await siteForToken(token);
  if (!siteId) {
    // Deliberately not "no such key" versus "revoked key". Either way the
    // answer to whoever is holding it is the same, and the difference is only
    // useful to somebody guessing.
    return NextResponse.json({ error: 'That key is not valid for any site.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON: an array of log lines, or { "hits": [...] }.' }, { status: 400 });
  }

  const hits = parseBatch(body);
  if (hits.length === 0) {
    return NextResponse.json(
      { ok: true, received: 0, note: 'Nothing in that batch had a user agent we could read.' },
      { status: 202 },
    );
  }

  const summary = await collect(siteId, hits);
  return NextResponse.json({ ok: true, ...summary });
}

/** So somebody wiring up a drain can check the URL answers before they send anything. */
export async function GET(request: Request) {
  const siteId = await siteForToken(request.headers.get('x-botready-key') ?? '');
  return siteId
    ? NextResponse.json({ ok: true, ready: true })
    : NextResponse.json({ error: 'That key is not valid for any site.' }, { status: 401 });
}
