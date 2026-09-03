/**
 * The webhook is idempotent: replaying the same event twice grants one
 * entitlement. This is the M6 gate, and it is tested against the same code
 * path the route runs, with a store that behaves like the unique index.
 */

import { describe, expect, it } from 'vitest';

import { grantEntitlement, type EntitlementStore, type Plan } from '../lib/entitlements';

/** Behaves like Postgres with a unique index on stripe_event_id. */
function fakeStore() {
  const users = new Map<string, string>();
  const rows: Array<{ user_id: string; plan: Plan; stripe_event_id: string }> = [];
  let created = 0;

  const store: EntitlementStore = {
    async findUserIdByEmail(email) {
      return users.get(email) ?? null;
    },
    async createUser(email) {
      created += 1;
      const id = `user-${created}`;
      users.set(email, id);
      return id;
    },
    async insertEntitlement(row) {
      if (rows.some((r) => r.stripe_event_id === row.stripe_event_id)) {
        return { inserted: false };
      }
      rows.push({ user_id: row.user_id, plan: row.plan, stripe_event_id: row.stripe_event_id });
      return { inserted: true };
    },
  };

  return { store, rows, users, get created() { return created; } };
}

const purchase = {
  eventId: 'evt_1',
  email: 'Buyer@Example.com',
  plan: 'fixpack' as const,
  stripeCustomerId: 'cus_1',
  currentPeriodEnd: null,
};

describe('grantEntitlement', () => {
  it('grants once and creates the user the first time it sees the email', async () => {
    const db = fakeStore();
    const outcome = await grantEntitlement(db.store, purchase);

    expect(outcome).toEqual({ granted: true, duplicate: false, userId: 'user-1' });
    expect(db.rows).toHaveLength(1);
    expect(db.created).toBe(1);
  });

  it('replaying the same event twice grants one entitlement', async () => {
    const db = fakeStore();
    const first = await grantEntitlement(db.store, purchase);
    const second = await grantEntitlement(db.store, purchase);

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.userId).toBe(first.userId);
    expect(db.rows).toHaveLength(1);
  });

  it('replaying ten times still grants one', async () => {
    const db = fakeStore();
    for (let i = 0; i < 10; i += 1) await grantEntitlement(db.store, purchase);
    expect(db.rows).toHaveLength(1);
    expect(db.created).toBe(1);
  });

  it('a second, different purchase by the same person grants a second entitlement', async () => {
    const db = fakeStore();
    await grantEntitlement(db.store, purchase);
    await grantEntitlement(db.store, { ...purchase, eventId: 'evt_2' });

    expect(db.rows).toHaveLength(2);
    expect(db.created).toBe(1);
    expect(new Set(db.rows.map((r) => r.user_id)).size).toBe(1);
  });

  it('matches the buyer to an existing user case-insensitively', async () => {
    const db = fakeStore();
    db.users.set('buyer@example.com', 'user-existing');
    const outcome = await grantEntitlement(db.store, purchase);

    expect(outcome.userId).toBe('user-existing');
    expect(db.created).toBe(0);
  });

  it('refuses a checkout with no email rather than granting to nobody', async () => {
    const db = fakeStore();
    await expect(grantEntitlement(db.store, { ...purchase, email: '  ' })).rejects.toThrow(
      /no customer email/,
    );
    expect(db.rows).toHaveLength(0);
  });

  it('carries the period end for a subscription and none for the one-time pack', async () => {
    const db = fakeStore();
    const seen: Array<string | null> = [];
    const spy: EntitlementStore = {
      ...db.store,
      async insertEntitlement(row) {
        seen.push(row.current_period_end);
        return db.store.insertEntitlement(row);
      },
    };

    await grantEntitlement(spy, purchase);
    await grantEntitlement(spy, {
      ...purchase,
      eventId: 'evt_sub',
      plan: 'monitor',
      currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
    });

    expect(seen).toEqual([null, '2026-10-01T00:00:00.000Z']);
  });
});
