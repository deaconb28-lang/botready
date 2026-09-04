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
  /** The previous finished scan's total, for the change column. Null when there is only one. */
  previousTotal: number | null;
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
  const previous = await previousTotals(rows.map((r) => r.siteId), rows.map((r) => r.scanId));
  return rank(
    segment,
    rows.map((r) => ({ ...r, previousTotal: previous.get(r.siteId) ?? null })),
  );
}

/**
 * The total of each site's second most recent complete scan, so the index can
 * print the change since last time. Two queries for the whole segment rather
 * than one per row.
 */
async function previousTotals(siteIds: string[], latestScanIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (siteIds.length === 0) return out;
  const supabase = publicClient();
  const latest = new Set(latestScanIds);

  const { data: scans } = await supabase
    .from('scans')
    .select('id, site_id, finished_at')
    .in('site_id', siteIds)
    .eq('status', 'complete')
    .order('finished_at', { ascending: false });

  const previousBySite = new Map<string, string>();
  for (const raw of scans ?? []) {
    const row = raw as { id: string; site_id: string };
    if (latest.has(row.id) || previousBySite.has(row.site_id)) continue;
    previousBySite.set(row.site_id, row.id);
  }
  if (previousBySite.size === 0) return out;

  const { data: scores } = await supabase
    .from('scores')
    .select('scan_id, total, created_at')
    .in('scan_id', [...previousBySite.values()])
    .order('created_at', { ascending: false });

  const totalByScan = new Map<string, number>();
  for (const raw of scores ?? []) {
    const row = raw as { scan_id: string; total: number };
    if (!totalByScan.has(row.scan_id)) totalByScan.set(row.scan_id, row.total);
  }
  for (const [siteId, scanId] of previousBySite) {
    const total = totalByScan.get(scanId);
    if (typeof total === 'number') out.set(siteId, total);
  }
  return out;
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
    previousTotal: null,
  };
}
