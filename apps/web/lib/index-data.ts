/**
 * The public index: every site in a segment, ranked.
 *
 * Reads the `index_rows` view, which joins each site to its latest finished
 * scan and that scan's latest score row. Blocked sites are in the list, labelled
 * blocked, and sorted after everything with a score: refusing the scanner is a
 * public fact about a site, and hiding it would make the index a list of sites
 * that let us in.
 */

import type { CategoryKey, Grade, PerAgentFetch } from '@botready/core';

import { publicClient } from './supabase';
import type { SegmentKey } from './site';

export interface IndexRow {
  siteId: string;
  domain: string;
  segment: string;
  isClaimed: boolean;
  scanId: string;
  status: 'complete' | 'blocked';
  finishedAt: string | null;
  scoringVersion: string | null;
  total: number | null;
  grade: Grade | null;
  categoryScores: Record<CategoryKey, number> | null;
  /** How many of the agent clients were refused, and how many were asked. */
  refused: { count: number; of: number } | null;
  jsRatio: number | null;
  rank: number;
}

export interface IndexView {
  segment: SegmentKey;
  rows: IndexRow[];
  scored: number;
  blocked: number;
  /** The most recent finished_at across the segment. */
  lastCheckedAt: string | null;
  scoringVersion: string | null;
}

export async function loadIndex(segment: SegmentKey): Promise<IndexView> {
  const { data, error } = await publicClient()
    .from('index_rows')
    .select('*')
    .eq('segment', segment);

  if (error) throw new Error(`Could not read the index: ${error.message}`);

  const rows = (data ?? []).map(toRow);
  return rank(segment, rows);
}

/** Pure, so the ordering rule is testable without a database. */
export function rank(segment: SegmentKey, unranked: Omit<IndexRow, 'rank'>[]): IndexView {
  const sorted = [...unranked].sort((a, b) => {
    // Scored before blocked; then by score, then by fewer refusals, then by
    // lower JS dependency, then by name so ties are stable between renders.
    const aScored = a.total !== null ? 1 : 0;
    const bScored = b.total !== null ? 1 : 0;
    if (aScored !== bScored) return bScored - aScored;
    if ((b.total ?? 0) !== (a.total ?? 0)) return (b.total ?? 0) - (a.total ?? 0);
    if ((a.refused?.count ?? 0) !== (b.refused?.count ?? 0)) {
      return (a.refused?.count ?? 0) - (b.refused?.count ?? 0);
    }
    if ((a.jsRatio ?? 0) !== (b.jsRatio ?? 0)) return (a.jsRatio ?? 0) - (b.jsRatio ?? 0);
    return a.domain.localeCompare(b.domain);
  });

  const rows = sorted.map((row, i) => ({ ...row, rank: i + 1 }));
  const finished = rows.map((r) => r.finishedAt).filter((t): t is string => Boolean(t)).sort();

  return {
    segment,
    rows,
    scored: rows.filter((r) => r.total !== null).length,
    blocked: rows.filter((r) => r.status === 'blocked').length,
    lastCheckedAt: finished[finished.length - 1] ?? null,
    scoringVersion: rows.find((r) => r.scoringVersion)?.scoringVersion ?? null,
  };
}

function toRow(raw: Record<string, unknown>): Omit<IndexRow, 'rank'> {
  const perAgent = (raw.per_agent ?? null) as Record<string, PerAgentFetch> | null;
  const refused = perAgent
    ? {
        count: Object.values(perAgent).filter((f) => f.status >= 400 || f.status === 0).length,
        of: Object.keys(perAgent).length,
      }
    : null;

  return {
    siteId: String(raw.site_id),
    domain: String(raw.domain),
    segment: String(raw.segment),
    isClaimed: Boolean(raw.is_claimed),
    scanId: String(raw.scan_id),
    status: raw.status === 'blocked' ? 'blocked' : 'complete',
    finishedAt: (raw.finished_at as string | null) ?? null,
    scoringVersion: (raw.scoring_version as string | null) ?? null,
    total: typeof raw.total === 'number' ? raw.total : null,
    grade: (raw.grade as Grade | null) ?? null,
    categoryScores: (raw.category_scores as Record<CategoryKey, number> | null) ?? null,
    refused,
    jsRatio: raw.js_ratio === null || raw.js_ratio === undefined ? null : Number(raw.js_ratio),
  };
}
