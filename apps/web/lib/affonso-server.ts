import { cookies } from 'next/headers';

import { REFERRAL_COOKIE } from './affonso';

/**
 * The visitor's affiliate referral, or an empty string.
 *
 * Empty is the ordinary case — most people arrive without an affiliate — so it
 * is a value rather than an error, and every caller can hand it to Stripe
 * unconditionally. Reading cookies throws outside a request scope, which is why
 * this cannot simply be `cookies().get(...)`.
 *
 * Separate from affonso.ts because that file is imported by a client component
 * and this one imports `next/headers`.
 */
export async function referral(): Promise<string> {
  try {
    return (await cookies()).get(REFERRAL_COOKIE)?.value ?? '';
  } catch {
    return '';
  }
}
