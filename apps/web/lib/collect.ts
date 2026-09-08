import { createHash } from 'node:crypto';

import { aiReferrer, claimedAgent, type AgentProof } from '@botready/core';

import { serviceClient } from './supabase';
import { verifyAgent } from './verify-agent';

/**
 * Turning somebody else's traffic logs into counts, without keeping the logs.
 *
 * Constraint 9 is the shape of this file. A human's address is read out of the
 * batch, used for nothing, and never written — there is no column for it and
 * no hash of it either, because a hashed IP is still personal data and the
 * question we are answering ("did ChatGPT send anyone to the pricing page")
 * does not need one. A crawler's address lives exactly as long as it takes to
 * ask DNS whether the claim is true, and the verdict is what gets stored.
 *
 * That leaves three things in the database: how many times each agent fetched
 * each day and whether we could prove it was them, a fortnight of individual
 * fetches so "what happened on Tuesday" is answerable, and a count of human
 * visits per AI surface per landing page.
 */

export interface RawHit {
  ts: string;
  ip: string | null;
  ua: string;
  path: string;
  status: number;
  bytes?: number | null;
  ms?: number | null;
  referrer?: string | null;
}

export interface CollectSummary {
  received: number;
  /** Fetches by something claiming to be an agent we know. */
  agentHits: number;
  verified: number;
  unverified: number;
  forged: number;
  /** Human visits an AI surface referred. */
  referrals: number;
  /** Everything else: ordinary human traffic, counted and then forgotten. */
  ignored: number;
}

const MAX_BATCH = 5_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Which site a token may write to, or null.
 *
 * Compared by hash, so the table holds nothing usable if it is ever read. The
 * last-used stamp is best effort — a write failure here must not reject a
 * batch that is otherwise fine.
 */
export async function siteForToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const db = serviceClient();
  const { data } = await db
    .from('ingest_keys')
    .select('id, site_id, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const row = data as { id: string; site_id: string; revoked_at: string | null } | null;
  if (!row || row.revoked_at) return null;

  db.from('ingest_keys').update({ last_used_at: new Date().toISOString() }).eq('id', row.id).then(
    () => {},
    () => {},
  );
  return row.site_id;
}

/**
 * Fold a batch into counts.
 *
 * Identity is resolved once per distinct (agent, address) pair rather than per
 * line: a crawler comes from a handful of addresses, so a batch of five
 * thousand hits is usually a few dozen lookups, nearly all of them cached from
 * the last batch.
 */
export async function collect(siteId: string, hits: RawHit[]): Promise<CollectSummary> {
  const db = serviceClient();
  const capped = hits.slice(0, MAX_BATCH);

  const summary: CollectSummary = {
    received: capped.length,
    agentHits: 0,
    verified: 0,
    unverified: 0,
    forged: 0,
    referrals: 0,
    ignored: 0,
  };

  // Resolve every distinct claim once. The map is keyed on the address because
  // the address is what DNS answers about, and it goes out of scope with this
  // function — it is never written anywhere.
  const verdicts = new Map<string, { agentId: string; proof: AgentProof }>();
  for (const hit of capped) {
    const claim = claimedAgent(hit.ua ?? '');
    if (!claim) continue;
    const key = `${claim.id}|${hit.ip ?? ''}`;
    if (verdicts.has(key)) continue;
    const id = await verifyAgent(hit.ua, hit.ip);
    if (id.agentId) verdicts.set(key, { agentId: id.agentId, proof: id.proof });
  }

  const rollups = new Map<string, { agent_id: string; proof: AgentProof; day: string; hits: number; ok: number; refused: number; bytes: number }>();
  const referrals = new Map<string, { day: string; surface: string; landing: string; visits: number }>();
  const rows: Array<Record<string, unknown>> = [];

  for (const hit of capped) {
    const day = (hit.ts ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const claim = claimedAgent(hit.ua ?? '');

    if (claim) {
      const verdict = verdicts.get(`${claim.id}|${hit.ip ?? ''}`) ?? { agentId: claim.id, proof: 'unverified' as AgentProof };
      summary.agentHits += 1;
      if (verdict.proof === 'forged') summary.forged += 1;
      else if (verdict.proof === 'unverified') summary.unverified += 1;
      else summary.verified += 1;

      const key = `${day}|${verdict.agentId}|${verdict.proof}`;
      const entry = rollups.get(key) ?? { agent_id: verdict.agentId, proof: verdict.proof, day, hits: 0, ok: 0, refused: 0, bytes: 0 };
      entry.hits += 1;
      if (hit.status >= 200 && hit.status < 300) entry.ok += 1;
      // A 401, 403 or 429 to something we proved was a real crawler is the
      // headline finding of the whole product, arriving from the other side.
      if ([401, 403, 429].includes(hit.status)) entry.refused += 1;
      entry.bytes += Number(hit.bytes ?? 0);
      rollups.set(key, entry);

      rows.push({
        site_id: siteId,
        seen_at: hit.ts,
        agent_id: verdict.agentId,
        proof: verdict.proof,
        path: trim(hit.path),
        status: hit.status,
        bytes: hit.bytes ?? null,
        ms: hit.ms ?? null,
      });
      continue;
    }

    // A person. Their address is in `hit.ip` and is about to go out of scope
    // without ever being read again, which is the whole of constraint 9.
    const surface = aiReferrer(hit.referrer ?? '');
    if (surface) {
      summary.referrals += 1;
      const key = `${day}|${surface.id}|${trim(hit.path)}`;
      const entry = referrals.get(key) ?? { day, surface: surface.id, landing: trim(hit.path), visits: 0 };
      entry.visits += 1;
      referrals.set(key, entry);
    } else {
      summary.ignored += 1;
    }
  }

  if (rows.length > 0) await db.from('agent_hits').insert(rows);

  // Rollups are added to rather than replaced, because a day arrives in many
  // batches and the second one must not overwrite the first.
  for (const r of rollups.values()) {
    await bumpRollup(siteId, r);
  }
  for (const r of referrals.values()) {
    await bumpReferral(siteId, r);
  }

  return summary;
}

async function bumpRollup(
  siteId: string,
  r: { agent_id: string; proof: AgentProof; day: string; hits: number; ok: number; refused: number; bytes: number },
): Promise<void> {
  const db = serviceClient();
  const { data } = await db
    .from('agent_rollups')
    .select('hits, ok, refused, bytes')
    .eq('site_id', siteId)
    .eq('day', r.day)
    .eq('agent_id', r.agent_id)
    .eq('proof', r.proof)
    .maybeSingle();

  const prev = (data ?? { hits: 0, ok: 0, refused: 0, bytes: 0 }) as { hits: number; ok: number; refused: number; bytes: number };
  await db.from('agent_rollups').upsert(
    {
      site_id: siteId,
      day: r.day,
      agent_id: r.agent_id,
      proof: r.proof,
      hits: prev.hits + r.hits,
      ok: prev.ok + r.ok,
      refused: prev.refused + r.refused,
      bytes: prev.bytes + r.bytes,
    },
    { onConflict: 'site_id,day,agent_id,proof' },
  );
}

async function bumpReferral(
  siteId: string,
  r: { day: string; surface: string; landing: string; visits: number },
): Promise<void> {
  const db = serviceClient();
  const { data } = await db
    .from('ai_referrals')
    .select('visits')
    .eq('site_id', siteId)
    .eq('day', r.day)
    .eq('surface', r.surface)
    .eq('landing', r.landing)
    .maybeSingle();

  const prev = (data as { visits: number } | null)?.visits ?? 0;
  await db
    .from('ai_referrals')
    .upsert(
      { site_id: siteId, day: r.day, surface: r.surface, landing: r.landing, visits: prev + r.visits },
      { onConflict: 'site_id,day,surface,landing' },
    );
}

/** Paths are stored to group by, not to replay. Query strings can carry anything. */
function trim(path: string): string {
  const clean = (path ?? '/').split('?')[0] ?? '/';
  return clean.length > 300 ? `${clean.slice(0, 300)}…` : clean;
}

/**
 * Read a batch in whichever shape it arrived.
 *
 * Two are accepted. Our own, which is what the docs show and what a shell
 * script can produce from an access log. And Vercel's log drain, because the
 * customers most likely to turn this on first are the ones who can point a
 * drain at a URL in two clicks and never think about it again.
 *
 * Anything unrecognised is dropped rather than guessed at. A log line we
 * cannot read is not a hit we can count.
 */
export function parseBatch(body: unknown): RawHit[] {
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { hits?: unknown[] })?.hits)
      ? (body as { hits: unknown[] }).hits
      : [];

  const out: RawHit[] = [];
  for (const raw of list) {
    const row = raw as Record<string, unknown>;
    // Vercel's shape: everything useful is under `proxy`.
    const proxy = row.proxy as Record<string, unknown> | undefined;
    if (proxy) {
      const ua = firstOf(proxy.userAgent);
      if (!ua) continue;
      out.push({
        ts: asIso(row.timestamp ?? proxy.timestamp),
        ip: str(proxy.clientIp) || null,
        ua,
        path: str(proxy.path) || '/',
        status: Number(proxy.statusCode ?? 0),
        bytes: num(proxy.bytes),
        ms: null,
        referrer: str(proxy.referer) || null,
      });
      continue;
    }

    const ua = str(row.ua ?? row.userAgent);
    if (!ua) continue;
    out.push({
      ts: asIso(row.ts ?? row.timestamp),
      ip: str(row.ip ?? row.clientIp) || null,
      ua,
      path: str(row.path ?? row.url) || '/',
      status: Number(row.status ?? row.statusCode ?? 0),
      bytes: num(row.bytes),
      ms: num(row.ms ?? row.duration),
      referrer: str(row.referrer ?? row.referer) || null,
    });
  }
  return out;
}

/** Vercel sends userAgent as an array of one. */
function firstOf(value: unknown): string {
  return Array.isArray(value) ? str(value[0]) : str(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIso(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}
