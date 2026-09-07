import { NextResponse, type NextRequest } from 'next/server';

import { SIGNUP_COOKIE } from '@/lib/affonso';
import { routeClient, safeNext } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback?code=…&next=/scan/…
 *
 * Where Supabase returns the browser after Google. The code is exchanged for a
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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`, request.url),
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url));

  // Affonso wants to know about signups, not just purchases, so an affiliate
  // can see that the traffic they sent turned into accounts. This is the only
  // place that can tell a signup from a sign-in: Google returns everybody
  // through here, and only a person whose account did not exist a moment ago is
  // new. The call itself has to happen in the browser, where the pixel lives,
  // so this hands the fact forward and components/site/AffonsoSignup spends it.
  const email = data.user?.email;
  if (email && isNewAccount(data.user?.created_at)) {
    response.cookies.set(SIGNUP_COOKIE, email, {
      path: '/',
      maxAge: 300,
      sameSite: 'lax',
      // Read and deleted by client script, so not httpOnly. It holds the
      // address of the person already signed in on this device, for five
      // minutes, on the way to the pixel that is about to be given it anyway.
      httpOnly: false,
      secure: new URL(request.url).protocol === 'https:',
    });
  }

  return response;
}

/**
 * Whether this sign-in created the account.
 *
 * By age rather than by comparing created_at with last_sign_in_at: on a first
 * sign-in those two are the same instant, which makes the comparison a test of
 * clock precision. "Made in the last minute" is the same question asked in a
 * way that cannot be wrong by a millisecond.
 */
function isNewAccount(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const age = Date.now() - Date.parse(createdAt);
  return Number.isFinite(age) && age >= 0 && age < 60_000;
}
