import { NextResponse } from 'next/server';

import { routeClient } from '@/lib/auth';
import { absoluteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/sign-out -> clears the session and goes home. */
export async function POST() {
  const supabase = await routeClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(absoluteUrl('/'), 303);
}
