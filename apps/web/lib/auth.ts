/**
 * Supabase Auth, Google only. There is no password anywhere in this product.
 *
 * Reading the current user is best effort: the whole diagnosis is public, so a
 * signed-out reader loses nothing but a higher rate limit and the fix-pack
 * download. Nothing here throws when auth is not configured.
 */

import { cookies } from 'next/headers';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

import { serverEnv } from './env';

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * The Supabase client bound to this request's cookies. Used by the route
 * handlers that sign someone in or out; reading a session only needs
 * `currentUser` below.
 */
export async function routeClient() {
  const store = await cookies();

  const cookieAdapter: CookieMethodsServer = {
    getAll: () => store.getAll(),
    setAll: (toSet) => {
      // In a Server Component this throws, because a component cannot set a
      // cookie. That is fine: the middleware refreshes the session, and a
      // read-only caller does not need to.
      try {
        for (const { name, value, options } of toSet) store.set(name, value, options);
      } catch {
        /* read-only context */
      }
    },
  };

  return createServerClient(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    cookies: cookieAdapter,
  });
}

/**
 * Whether this request carries a Supabase session at all.
 *
 * supabase-ssr stores the session in `sb-<project-ref>-auth-token`, split
 * across `.0`, `.1` and so on when it is too large for one cookie. No cookie of
 * that shape means no session, and asking Supabase about it is a network round
 * trip whose answer we already know.
 */
async function hasAuthCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
}

/**
 * The signed-in person, or null.
 *
 * The early return matters more than it looks. SiteHeader calls this, so every
 * page in the product calls it, including the marketing pages that most people
 * only ever see signed out. Without the check, a launch-day crowd on the home
 * page is one Supabase Auth request per visitor: a third of a second added to
 * every render, and the front page of a site about being reachable going down
 * because a service it does not need for that page is rate limiting us.
 *
 * With it, a visitor with no session costs one cookie read.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  try {
    if (!(await hasAuthCookie())) return null;
    const supabase = await routeClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    // Auth not configured, or no cookie. Either way: not signed in.
    return null;
  }
}

/** Whether this user has bought the fix pack for this scan. */
export async function hasFixpackEntitlement(userId: string): Promise<boolean> {
  const supabase = await routeClient();
  const { data } = await supabase
    .from('entitlements')
    .select('plan, current_period_end')
    .eq('user_id', userId)
    .in('plan', ['fixpack', 'monitor']);

  if (!data || data.length === 0) return false;

  return data.some((row) => {
    const entitlement = row as { plan: string; current_period_end: string | null };
    // The fix pack is a one-time purchase and does not expire. A monitor
    // subscription does, and a lapsed one does not unlock a download.
    if (entitlement.plan === 'fixpack') return true;
    if (!entitlement.current_period_end) return false;
    return new Date(entitlement.current_period_end).getTime() > Date.now();
  });
}

/**
 * A redirect target that stays on this site. An open redirect through a
 * sign-in link is a phishing kit, so anything that is not a path is dropped.
 */
export function safeNext(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  if (candidate.startsWith('/\\')) return '/';
  return candidate;
}
