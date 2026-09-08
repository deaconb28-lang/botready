import { visibility, visibilityOver, type RunObservation, type Visibility } from '@botready/core';

import { serviceClient } from './supabase';

export interface VisibilityView {
  /** The whole window. */
  now: Visibility;
  /** The same measurement week by week, oldest first. */
  trend: Array<{ label: string } & Visibility>;
  /** Where the runs came from, so an empty panel can say which. */
  rivals: string[];
  windowDays: number;
}

const WINDOW_DAYS = 28;

/**
 * Share of voice for one site, from the runs already in the table.
 *
 * Derived on read rather than stored. Constraint 2 asks that nothing derived
 * is ever the only copy of anything, and the runs are the copy — so a stored
 * visibility_scores table would be a cache, not a record, and caching a number
 * this cheap before anyone has complained about the query is the kind of
 * optimisation that turns into a second source of truth. When the method
 * changes, every figure on this page changes with it, which is the whole point
 * of keeping the observations.
 *
 * The rival set is the customer's own competitor list. An open denominator —
 * every domain that ever appeared in an answer — makes share of voice move
 * because Wikipedia was cited, which is not a fact anybody can act on.
 */
export async function loadVisibility(siteId: string, domain: string): Promise<VisibilityView> {
  const db = serviceClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000).toISOString();

  const [promptRows, rivalRows] = await Promise.all([
    db.from('prompts').select('id').eq('site_id', siteId).eq('is_active', true),
    db.from('competitors').select('sites:competitor_site_id(domain)').eq('site_id', siteId),
  ]);

  const promptIds = ((promptRows.data ?? []) as Array<{ id: string }>).map((p) => p.id);
  const rivals = ((rivalRows.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => (row.sites as { domain?: string } | null)?.domain)
    .filter((d): d is string => Boolean(d));

  if (promptIds.length === 0) {
    return { now: visibility({ self: domain, rivals, runs: [] }), trend: [], rivals, windowDays: WINDOW_DAYS };
  }

  const { data } = await db
    .from('prompt_runs')
    .select('prompt_id, engine_id, cited_domains, error, ran_at')
    .in('prompt_id', promptIds)
    .gte('ran_at', since)
    .order('ran_at', { ascending: true })
    .limit(5000);

  const runs: RunObservation[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    promptId: String(row.prompt_id),
    engineId: String(row.engine_id ?? 'claude'),
    citedDomains: Array.isArray(row.cited_domains) ? (row.cited_domains as string[]) : [],
    error: (row.error as string | null) ?? null,
    ranAt: String(row.ran_at ?? ''),
  }));

  const input = { self: domain, rivals };
  return {
    now: visibility({ ...input, runs }),
    trend: visibilityOver(input, weeksOf(runs)),
    rivals,
    windowDays: WINDOW_DAYS,
  };
}

/**
 * Four weekly buckets, oldest first, including the weeks with no runs in them.
 *
 * A week with nothing asked is kept and reads as zero everything, with `runs`
 * at zero to say which kind of zero it is — the same distinction the pure
 * function draws between "we asked nothing" and "we asked and nobody cited
 * you". Dropping the empty weeks would draw a flat line through a gap.
 */
function weeksOf(runs: RunObservation[]): Array<{ label: string; runs: RunObservation[] }> {
  const weeks = Math.ceil(WINDOW_DAYS / 7);
  const now = Date.now();
  const out: Array<{ label: string; runs: RunObservation[] }> = [];

  for (let back = weeks - 1; back >= 0; back -= 1) {
    const start = now - (back + 1) * 7 * 24 * 3600_000;
    const end = now - back * 7 * 24 * 3600_000;
    out.push({
      label: back === 0 ? 'This week' : `${back}w ago`,
      runs: runs.filter((r) => {
        const at = Date.parse(r.ranAt ?? '');
        return Number.isFinite(at) && at >= start && at < end;
      }),
    });
  }
  return out;
}
