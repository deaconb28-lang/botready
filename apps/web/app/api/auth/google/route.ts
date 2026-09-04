import { NextResponse, type NextRequest } from 'next/server';

import { routeClient, safeNext } from '@/lib/auth';
import { absoluteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google?next=/account -> 303 to Google, via Supabase Auth.
 *
 * Supabase runs the OAuth exchange and sends the browser back to
 * /auth/callback with a code, the same path the magic link uses. The Google
 * provider has to be enabled in the Supabase project for this to work; when it
 * is not, Supabase answers with the reason and it is shown on the sign-in page.
 */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const supabase = await routeClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent(next)}`), queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) {
    return NextResponse.redirect(absoluteUrl(`/sign-in?error=${encodeURIComponent(error?.message ?? 'Google sign-in is not available.')}&next=${encodeURIComponent(next)}`), 303);
  }
  return NextResponse.redirect(data.url, 303);
}
