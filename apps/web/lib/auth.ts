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

export async function currentUser(): Promise<CurrentUser | null> {
  try {
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
