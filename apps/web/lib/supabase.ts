import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { serverEnv } from './env';

/**
 * Two clients, and the difference matters.
 *
 * `publicClient` uses the anon key and is subject to row level security, which
 * db/schema.sql sets up so that scans, evidence and scores are world readable
 * and everything tied to a person is not. Reading a result page needs nothing
 * more than this.
 *
 * `serviceClient` bypasses row level security entirely. It exists for the two
 * things the anon role has no policy for: inserting a scan row, and granting an
 * entitlement from the Stripe webhook. It must never be imported into anything
 * that ships to a browser.
 */

let cachedPublic: SupabaseClient | null = null;
let cachedService: SupabaseClient | null = null;

export function publicClient(): SupabaseClient {
  cachedPublic ??= createClient(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    auth: { persistSession: false },
  });
  return cachedPublic;
}

export function serviceClient(): SupabaseClient {
  cachedService ??= createClient(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedService;
}
