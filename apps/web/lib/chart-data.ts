/**
 * The chart: every scanned site, ranked, live from `chart_rows`.
 *
 * The view does the ranking, last week's ranking, the peak and the weeks
 * count, because all four are questions about the whole table and Postgres
 * answers those in one pass. This file turns a row into something a component
 * can render and works out which way the arrow points.
 *
 * Nothing is cached here on purpose. A chart that lags the result pages is
 * worse than no chart, and it is one indexed read.
 */

import type { Grade } from '@botready/core';

import { iconCandidates } from './site-identity';
import { publicClient } from './supabase';

export type Move = 'new' | 'up' | 'down' | 'same';

export interface ChartRow {
  rank: number;
  siteId: string;
  scanId: string;
  domain: string;
  segment: string | null;
  isClaimed: boolean;
  status: 'complete' | 'blocked';
  total: number | null;
  grade: Grade | null;
  /** Null when the site has no score at least a week old: that is a new entry. */
  prevRank: number | null;
  peakTotal: number | null;
  weeksOn: number;
  /** The site's own words, from its own homepage. */
  description: string | null;
  iconCandidates: string[];
  move: Move;
  /** How many places, for up and down. Zero otherwise. */
  moveBy: number;
  finishedAt: string | null;
}

export interface ChartView {
  /** Ranked sites only: everything in here has a score. */
  rows: ChartRow[];
  /** Sites that refused the scanner. Counted on the page, never listed. */
  blocked: number;
  lastCheckedAt: string | null;
  scoringVersion: string | null;
}

interface Raw {
  site_id: string;
  scan_id: string;
  domain: string;
  segment: string | null;
  is_claimed: boolean;
  status: string;
  finished_at: string | null;
  total: number | null;
  grade: string | null;
  scoring_version: string | null;
  prev_total: number | null;
  peak_total: number | null;
  weeks_on: number | null;
  site_title: string | null;
  site_description: string | null;
  site_icon: string | null;
  rank: number;
  prev_rank: number | null;
}

export async function loadChart(segment?: string): Promise<ChartView> {
  let query = publicClient().from('chart_rows').select('*').order('rank', { ascending: true });
  if (segment) query = query.eq('segment', segment);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the chart: ${error.message}`);

  const all = (data ?? []).map((r) => toRow(r as Raw));

  // Only sites that have a score. A chart is an ordering, and a site with no
  // number has no place in one — a row reading "—" occupies a rank it did not
  // earn and invites the reader to compare it with the rows above, which is the
  // one thing it cannot be compared with.
  //
  // They are counted rather than listed. "10 refused the crawler" is true, is
  // the product's whole argument in one line, and costs no rows; naming them
  // would be a leaderboard of sites that never entered.
  //
  // Ranks survive the filter untouched. The view orders by total descending
  // with nulls last over a unique domain, so the scored rows already hold 1..n
  // and nothing needs renumbering.
  const rows = all.filter((r) => r.status !== 'blocked' && r.total !== null);

  return {
    rows,
    blocked: all.filter((r) => r.status === 'blocked').length,
    // From the rows on the page rather than from every row, so "updated 4 hours
    // ago" describes what is being looked at.
    lastCheckedAt: rows.reduce<string | null>(
      (newest, r) => (r.finishedAt && (!newest || r.finishedAt > newest) ? r.finishedAt : newest),
      null,
    ),
    scoringVersion: (data ?? []).map((r) => (r as Raw).scoring_version).find(Boolean) ?? null,
  };
}

function toRow(r: Raw): ChartRow {
  const move: Move =
    r.prev_rank === null ? 'new' : r.prev_rank > r.rank ? 'up' : r.prev_rank < r.rank ? 'down' : 'same';

  return {
    rank: Number(r.rank),
    siteId: r.site_id,
    scanId: r.scan_id,
    domain: r.domain,
    segment: r.segment,
    isClaimed: Boolean(r.is_claimed),
    status: r.status === 'blocked' ? 'blocked' : 'complete',
    total: r.total,
    grade: (r.grade as Grade | null) ?? null,
    prevRank: r.prev_rank === null ? null : Number(r.prev_rank),
    peakTotal: r.peak_total,
    // A site with a score has been here at least one week, in the sense the
    // column means: it has appeared on one chart.
    weeksOn: Math.max(1, Number(r.weeks_on ?? 1)),
    // Its description if it has one, otherwise its title. A site with neither
    // is a site with nothing for a client to read, which the score says louder.
    description: clean(r.site_description) ?? clean(r.site_title),
    iconCandidates: iconCandidates(r.site_icon ?? '', `https://${r.domain}`),
    move,
    moveBy: r.prev_rank === null ? 0 : Math.abs(Number(r.prev_rank) - Number(r.rank)),
    finishedAt: r.finished_at,
  };
}

/** One line, trimmed, or nothing. A description is a chart row's subtitle. */
function clean(value: string | null): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export interface Standing {
  /** How this total places among every scored site. 1 is best. */
  rank: number;
  /** How many sites have a score at all. */
  of: number;
  /** How many of them reached an A. */
  atA: number;
  /** The nearest site above, and what it scored. Null at the top. */
  nextUp: { domain: string; total: number } | null;
  /** Points needed to pass it. Null at the top. */
  gap: number | null;
  /** How many sites that would clear, ties included. Null at the top. */
  clears: number | null;
}

/**
 * Where a score sits against every other site we have measured.
 *
 * True, comparative and it cuts both ways, which is the only kind of pressure
 * worth applying: a D is worse when you can see forty sites above it, and an A
 * is worth more when you can see how few there are.
 *
 * The gap is the part that turns it into something other than a scolding.
 * "40th of 41" is a fact about the past; "four points clears three sites" is a
 * target, and it is the same fact.
 *
 * Null below ten scored sites. "Third of four" is not a standing, and dressing
 * a tiny sample up as one is the sort of thing this product exists to argue
 * against.
 */
export async function standingFor(total: number | null): Promise<Standing | null> {
  if (total === null) return null;
  const client = publicClient();
  const rows = () => client.from('chart_rows').select('site_id', { count: 'exact', head: true });

  const [better, scored, aGrade, above] = await Promise.all([
    rows().gt('total', total),
    rows().not('total', 'is', null),
    rows().eq('grade', 'A'),
    // The nearest score above this one. Everything above is at least this, so
    // reaching it by a point passes every site sitting on it.
    client
      .from('chart_rows')
      .select('domain,total')
      .gt('total', total)
      .order('total', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const of = scored.count ?? 0;
  if (of < 10) return null;

  const next = (above.data ?? null) as { domain: string; total: number } | null;
  const ties = next
    ? await client.from('chart_rows').select('site_id', { count: 'exact', head: true }).eq('total', next.total)
    : null;

  return {
    rank: (better.count ?? 0) + 1,
    of,
    atA: aGrade.count ?? 0,
    nextUp: next,
    gap: next ? next.total - total + 1 : null,
    clears: next ? (ties?.count ?? 1) : null,
  };
}
