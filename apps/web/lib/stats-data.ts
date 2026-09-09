import { catalog } from '@botready/core';

import { publicClient } from './supabase';

/**
 * The public statistics, from scans people already asked for.
 *
 * Every figure here is an aggregate over the corpus rather than an estimate,
 * which is the entire argument for publishing it. This category is full of
 * round numbers with no method attached — "100 million people search with AI
 * every day" — and the useful thing we can do instead is show figures with a
 * sample size and a definition beside each one.
 *
 * Six views in migration 0016 do the grouping, because PostgREST has no group
 * by and because a rate belongs next to the denominator it was taken over.
 * Nothing here computes an average in JavaScript over a page of rows: that
 * would silently be an average of the first thousand.
 *
 * Every read degrades to null rather than throwing. A statistics page that
 * 500s because one aggregate is unavailable is worse than one with a gap in
 * it, and the page renders each block only when its own numbers arrived.
 */

export interface ClientRate {
  agentId: string;
  label: string;
  isControl: boolean;
  asked: number;
  refused: number;
  served: number;
  refusedPct: number;
}

export interface Asymmetry {
  scans: number;
  browserServed: number;
  divergent: number;
  googleAllowedOthersNot: number;
}

export interface CheckRate {
  key: string;
  label: string;
  category: string;
  ran: number;
  failed: number;
  failedPct: number;
}

export interface Outcomes {
  scans: number;
  complete: number;
  blocked: number;
  errored: number;
  blockedPct: number;
}

export interface ProfileStat {
  profile: string;
  scoringVersion: string;
  scored: number;
  median: number;
  worst: number;
  best: number;
}

export interface PublicStats {
  clients: ClientRate[];
  asymmetry: Asymmetry | null;
  checks: CheckRate[];
  outcomes: Outcomes | null;
  profiles: ProfileStat[];
  /** When this was read. The page is dynamic, so it is always now. */
  readAt: string;
}

/**
 * The share of divergent sites that let Google-Extended through.
 *
 * Out here rather than inline in the page because it is the one figure on
 * /stats that is arithmetic rather than a column, it is the sentence that
 * travels, and the denominator is easy to get wrong: it is the sites that
 * refused somebody, not all the sites we scanned. Null when nothing diverged,
 * which is a percentage of zero and not a zero percent.
 */
export function asymmetryShare(a: Asymmetry | null): number | null {
  if (!a || a.divergent === 0) return null;
  return Math.round((a.googleAllowedOthersNot / a.divergent) * 100);
}

/** Nothing measured, or nothing readable. The page renders its own gaps. */
function noStats(): PublicStats {
  return { clients: [], asymmetry: null, checks: [], outcomes: null, profiles: [], readAt: new Date().toISOString() };
}

export async function loadPublicStats(): Promise<PublicStats> {
  // The client is built from environment, so this throws rather than rejecting
  // when a deploy is missing a variable. Caught here for the same reason each
  // individual read is: a page of gaps beats a 500.
  let db: ReturnType<typeof publicClient>;
  try {
    db = publicClient();
  } catch {
    return noStats();
  }

  const [clients, asymmetry, checks, outcomes, profiles] = await Promise.all([
    db.from('client_refusal_rates').select('*').then(
      (r) => (r.data ?? []) as Array<Record<string, number | string>>,
      () => [],
    ),
    db.from('google_extended_asymmetry').select('*').maybeSingle().then(
      (r) => r.data as Record<string, number> | null,
      () => null,
    ),
    db.from('check_failure_rates').select('*').then(
      (r) => (r.data ?? []) as Array<Record<string, number | string>>,
      () => [],
    ),
    db.from('scan_outcome_rates').select('*').maybeSingle().then(
      (r) => r.data as Record<string, number> | null,
      () => null,
    ),
    db.from('profile_stats').select('*').then(
      (r) => (r.data ?? []) as Array<Record<string, number | string>>,
      () => [],
    ),
  ]);

  return {
    // Catalog order, control first, so the row reads the way the result page's
    // client table reads.
    clients: catalog.agents
      .map((agent) => {
        const row = clients.find((c) => c.agent_id === agent.id);
        if (!row) return null;
        return {
          agentId: agent.id,
          label: agent.label,
          isControl: agent.role === 'control',
          asked: Number(row.asked ?? 0),
          refused: Number(row.refused ?? 0),
          served: Number(row.served ?? 0),
          refusedPct: Number(row.refused_pct ?? 0),
        };
      })
      .filter((c): c is ClientRate => c !== null),

    asymmetry: asymmetry
      ? {
          scans: Number(asymmetry.scans ?? 0),
          browserServed: Number(asymmetry.browser_served ?? 0),
          divergent: Number(asymmetry.divergent ?? 0),
          googleAllowedOthersNot: Number(asymmetry.google_allowed_others_not ?? 0),
        }
      : null,

    // Only checks that actually failed somewhere, worst first. A check with no
    // failures is not a finding and would pad the table.
    checks: checks
      .map((row) => {
        const def = catalog.checks.find((c) => c.key === row.check_key);
        return {
          key: String(row.check_key),
          label: def?.label ?? String(row.check_key),
          category: def?.category ?? '',
          ran: Number(row.ran ?? 0),
          failed: Number(row.failed ?? 0),
          failedPct: Number(row.failed_pct ?? 0),
        };
      })
      .filter((c) => c.failed > 0)
      .sort((a, b) => b.failedPct - a.failedPct),

    outcomes: outcomes
      ? {
          scans: Number(outcomes.scans ?? 0),
          complete: Number(outcomes.complete ?? 0),
          blocked: Number(outcomes.blocked ?? 0),
          errored: Number(outcomes.errored ?? 0),
          blockedPct: Number(outcomes.blocked_pct ?? 0),
        }
      : null,

    profiles: profiles
      .map((row) => ({
        profile: String(row.profile),
        scoringVersion: String(row.scoring_version),
        scored: Number(row.scored ?? 0),
        median: Number(row.median ?? 0),
        worst: Number(row.worst ?? 0),
        best: Number(row.best ?? 0),
      }))
      .sort((a, b) => b.scored - a.scored),

    readAt: new Date().toISOString(),
  };
}
