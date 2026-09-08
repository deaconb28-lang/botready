import { randomBytes } from 'node:crypto';

import { knownAgent, type AgentProof } from '@botready/core';

import { hashToken } from './collect';
import { serviceClient } from './supabase';

export interface AgentRow {
  agentId: string;
  label: string;
  vendor: string;
  purpose: string;
  verified: number;
  unverified: number;
  forged: number;
  refused: number;
  hits: number;
}

export interface CrawlerView {
  /** Whether a log drain has ever sent us anything for this site. */
  receiving: boolean;
  agents: AgentRow[];
  daily: Array<{ day: string; verified: number; unverified: number; forged: number }>;
  referrals: Array<{ surface: string; visits: number }>;
  totals: { hits: number; verified: number; unverified: number; forged: number; refused: number };
  key: { hint: string; lastUsedAt: string | null } | null;
  windowDays: number;
}

const WINDOW_DAYS = 30;

/**
 * What actually fetched this site, from the rollups the collector writes.
 *
 * The four verdicts are carried all the way to the interface rather than being
 * summed into one number on the way. That is the whole product: everyone else
 * in this category prints a user-agent count and calls it crawler traffic, and
 * the difference between "ChatGPT fetched you 4,000 times" and "4,000 requests
 * claimed to be ChatGPT and we could prove 3,100 of them" is the difference
 * between a number somebody can act on and one that flatters them.
 */
export async function loadCrawlers(siteId: string): Promise<CrawlerView> {
  const db = serviceClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000).toISOString().slice(0, 10);

  const [rollupRows, referralRows, keyRows] = await Promise.all([
    db.from('agent_rollups').select('*').eq('site_id', siteId).gte('day', since),
    db.from('ai_referrals').select('surface, visits').eq('site_id', siteId).gte('day', since),
    db
      .from('ingest_keys')
      .select('hint, last_used_at, revoked_at')
      .eq('site_id', siteId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const rollups = (rollupRows.data ?? []) as Array<{
    day: string;
    agent_id: string;
    proof: AgentProof;
    hits: number;
    ok: number;
    refused: number;
  }>;

  const byAgent = new Map<string, AgentRow>();
  const byDay = new Map<string, { day: string; verified: number; unverified: number; forged: number }>();
  const totals = { hits: 0, verified: 0, unverified: 0, forged: 0, refused: 0 };

  for (const r of rollups) {
    const def = knownAgent(r.agent_id);
    const row =
      byAgent.get(r.agent_id) ??
      {
        agentId: r.agent_id,
        label: def?.label ?? r.agent_id,
        vendor: def?.vendor ?? 'Unknown',
        purpose: def?.purpose ?? 'search',
        verified: 0,
        unverified: 0,
        forged: 0,
        refused: 0,
        hits: 0,
      };

    const bucket = r.proof === 'forged' ? 'forged' : r.proof === 'unverified' ? 'unverified' : 'verified';
    row[bucket] += r.hits;
    row.hits += r.hits;
    row.refused += r.refused;
    byAgent.set(r.agent_id, row);

    const day = byDay.get(r.day) ?? { day: r.day, verified: 0, unverified: 0, forged: 0 };
    day[bucket] += r.hits;
    byDay.set(r.day, day);

    totals.hits += r.hits;
    totals[bucket] += r.hits;
    totals.refused += r.refused;
  }

  const referralTally = new Map<string, number>();
  for (const raw of referralRows.data ?? []) {
    const r = raw as { surface: string; visits: number };
    referralTally.set(r.surface, (referralTally.get(r.surface) ?? 0) + r.visits);
  }

  const key = (keyRows.data ?? [])[0] as { hint: string; last_used_at: string | null } | undefined;

  return {
    receiving: rollups.length > 0,
    agents: [...byAgent.values()].sort((a, b) => b.hits - a.hits),
    daily: fillDays(byDay),
    referrals: [...referralTally.entries()]
      .map(([surface, visits]) => ({ surface, visits }))
      .sort((a, b) => b.visits - a.visits),
    totals,
    key: key ? { hint: key.hint, lastUsedAt: key.last_used_at } : null,
    windowDays: WINDOW_DAYS,
  };
}

/** Every day in the window, including the silent ones. */
function fillDays(
  byDay: Map<string, { day: string; verified: number; unverified: number; forged: number }>,
): Array<{ day: string; verified: number; unverified: number; forged: number }> {
  const out = [];
  for (let back = WINDOW_DAYS - 1; back >= 0; back -= 1) {
    const day = new Date(Date.now() - back * 24 * 3600_000).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, verified: 0, unverified: 0, forged: 0 });
  }
  return out;
}

/**
 * Mint an ingest key. The plaintext is returned once and never stored.
 *
 * Any existing key for the site is revoked in the same breath, because two
 * live keys for one drain is a state nobody asked for and the interface has no
 * way to explain.
 */
export async function mintIngestKey(siteId: string, userId: string): Promise<string> {
  const token = `brk_${randomBytes(24).toString('base64url')}`;
  const db = serviceClient();

  await db.from('ingest_keys').update({ revoked_at: new Date().toISOString() }).eq('site_id', siteId).is('revoked_at', null);
  await db.from('ingest_keys').insert({
    site_id: siteId,
    created_by: userId,
    token_hash: hashToken(token),
    // Enough to tell two keys apart in a list, not enough to reconstruct one.
    hint: `${token.slice(0, 8)}…${token.slice(-4)}`,
  });

  return token;
}
