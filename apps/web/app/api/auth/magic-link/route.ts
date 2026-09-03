import { NextResponse, type NextRequest } from 'next/server';

import { routeClient, safeNext } from '@/lib/auth';
import { rateLimit } from '@/lib/redis';
import { absoluteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/magic-link  { email, next? }
 *
 * Magic link only. There is no password anywhere in this product. The email
 * carries a one-time link back to /auth/callback, which exchanges the code for
 * a session and sends the person on to wherever they were going.
 *
 * Rate limited per address, because an endpoint that sends email on request is
 * an endpoint that sends email on request.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; next?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with an email in it.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });
  }

  const next = safeNext(typeof body.next === 'string' ? body.next : '/');

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const verdict = await rateLimit(`magic:${ip}`, 10);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in emails from this connection. Wait an hour.' },
      { status: 429, headers: { 'retry-after': String(verdict.resetSeconds) } },
    );
  }

  const supabase = await routeClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: `The sign-in email could not be sent: ${error.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true, email });
}
