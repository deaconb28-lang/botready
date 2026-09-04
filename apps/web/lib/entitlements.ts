/**
 * Granting an entitlement from a Stripe event, once.
 *
 * Stripe retries webhooks, sometimes for days, and a retry that grants a second
 * entitlement is a bug that costs money in the direction of the customer rather
 * than us — which is the polite direction, but still a bug. Two guards:
 *
 *   1. entitlements.stripe_event_id is unique. A replay of the same event hits
 *      the constraint and is treated as already granted. This is the guard that
 *      must hold.
 *   2. A short-lived once-marker in Redis, which saves the round trip on the
 *      common case. It is allowed to fail open, because the constraint is there.
 *
 * The buyer need not have an account. Stripe Checkout collected their email;
 * this finds or creates the Supabase auth user for it, grants the entitlement,
 * and signing in with the same address is what turns the purchase into a session.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type Plan = 'fixpack' | 'monitor';

export interface GrantInput {
  /** Stripe's event id, the idempotency key. */
  eventId: string;
  email: string;
  plan: Plan;
  stripeCustomerId: string | null;
  /** For subscriptions. Null for the one-time fix pack, which never expires. */
  currentPeriodEnd: Date | null;
}

export interface GrantOutcome {
  granted: boolean;
  /** True when this event had already been applied. */
  duplicate: boolean;
  userId: string;
}

/**
 * The pieces of Supabase this needs, narrowed so a test can hand in a fake and
 * so the function cannot reach for anything else.
 */
export interface EntitlementStore {
  findUserIdByEmail(email: string): Promise<string | null>;
  createUser(email: string): Promise<string>;
  /**
   * Inserts the row. Resolves `inserted: false` when stripe_event_id already
   * exists, rather than throwing, because that is the expected replay path.
   */
  insertEntitlement(row: {
    user_id: string;
    plan: Plan;
    stripe_customer_id: string | null;
    stripe_event_id: string;
    current_period_end: string | null;
  }): Promise<{ inserted: boolean }>;
}

export async function grantEntitlement(
  store: EntitlementStore,
  input: GrantInput,
): Promise<GrantOutcome> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('A Stripe checkout completed with no customer email.');

  const userId = (await store.findUserIdByEmail(email)) ?? (await store.createUser(email));

  const { inserted } = await store.insertEntitlement({
    user_id: userId,
    plan: input.plan,
    stripe_customer_id: input.stripeCustomerId,
    stripe_event_id: input.eventId,
    current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
  });

  return { granted: inserted, duplicate: !inserted, userId };
}

/** The real store, over the service-role client. */
export function supabaseStore(client: SupabaseClient): EntitlementStore {
  return {
    async findUserIdByEmail(email) {
      // The admin API has no lookup by email, only a paged list. Filtering a
      // page is fine at this scale, and the alternative is a second table.
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const user = data.users.find((u) => u.email?.toLowerCase() === email);
      return user?.id ?? null;
    },

    async createUser(email) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        // Confirmed, because Stripe already delivered a receipt to it and the
        // signing in as that address is the proof of control that matters.
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error('createUser returned no user');
      return data.user.id;
    },

    async insertEntitlement(row) {
      const { error } = await client.from('entitlements').insert(row);
      if (!error) return { inserted: true };
      // 23505 is unique_violation. Anything else is a real failure.
      if (error.code === '23505') return { inserted: false };
      throw error;
    },
  };
}
