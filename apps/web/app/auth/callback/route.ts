import { NextResponse, type NextRequest } from 'next/server';

import { routeClient, safeNext } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback?code=…&next=/scan/…
 *
 * The link in the magic-link email lands here. The code is exchanged for a
 * session cookie and the person continues to wherever they were going, which is
 * almost always a result page with a download button on it.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing-code', request.url));
  }

  const supabase = await routeClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
