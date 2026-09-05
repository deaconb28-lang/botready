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

export interface EntitlementRow {
  plan: string;
  current_period_end: string | null;
  domain: string | null;
}

/** Every entitlement this person holds. One query; the rules are below. */
async function entitlementsFor(userId: string): Promise<EntitlementRow[]> {
  const supabase = await routeClient();
  const { data } = await supabase
    .from('entitlements')
    .select('plan, current_period_end, domain')
    .eq('user_id', userId)
    .in('plan', ['fixpack', 'monitor']);
  return (data ?? []) as EntitlementRow[];
}

/** A monitor subscription that has not lapsed. The fix pack never expires. */
export function live(row: EntitlementRow, now: number = Date.now()): boolean {
  if (row.plan === 'fixpack') return true;
  if (!row.current_period_end) return false;
  return new Date(row.current_period_end).getTime() > now;
}

/**
 * The rule, with no database in it, so it can be tested as the rule.
 *
 * A row covers a domain when it is live and either names that domain or names
 * none at all. Naming none is the pre-2026-09-05 grant and means everything;
 * see the note on hasFixpackFor for why that stays.
 */
export function coversDomain(
  rows: EntitlementRow[],
  domain: string | null,
  now: number = Date.now(),
): boolean {
  const target = domain?.trim().toLowerCase() ?? null;
  return rows.some(
    (row) => live(row, now) && (row.domain === null || (target !== null && row.domain.toLowerCase() === target)),
  );
}

/**
 * Whether this person may download the fix pack for this domain.
 *
 * A pack is bought for one domain now. This used to ask only whether they had
 * bought anything at all, and the download route takes an arbitrary scan id,
 * so a single $15 payment unlocked the generated files for every domain that
 * had ever been scanned — which, with a public index of scanned domains, is
 * the catalogue.
 *
 * Three ways to hold it:
 *
 *   - a fix pack bought for this domain, which never expires. Re-scan as often
 *     as you like; the pack is regenerated from the latest evidence and you
 *     bought the domain, not the snapshot.
 *   - a fix pack with no domain on it. Those rows predate the change and were
 *     sold as unlimited, so they stay unlimited. Nobody loses what they paid
 *     for, and no backfill can invent a scope a purchase never had.
 *   - a live monitor subscription for this domain, because the pricing page
 *     says monitoring includes the pack.
 */
export async function hasFixpackFor(userId: string, domain: string | null): Promise<boolean> {
  return coversDomain(await entitlementsFor(userId), domain);
}

/**
 * Whether they hold any fix pack at all, for any domain.
 *
 * Two callers, and neither is an access check: the app nav, which offers a
 * download when there is something to download, and checkout, which charges
 * the repeat price to somebody who already owns one. Access is
 * `hasFixpackFor`.
 */
export async function ownsAnyFixpack(userId: string): Promise<boolean> {
  return (await entitlementsFor(userId)).some((row) => live(row));
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
