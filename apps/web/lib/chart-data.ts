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
  rows: ChartRow[];
  /** Sites that refused the scanner. In the list, at the bottom, labelled. */
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

  const raw = (data ?? []) as Raw[];
  const rows = raw.map(toRow);

  return {
    rows,
    blocked: rows.filter((r) => r.status === 'blocked').length,
    lastCheckedAt: raw.reduce<string | null>(
      (newest, r) => (r.finished_at && (!newest || r.finished_at > newest) ? r.finished_at : newest),
      null,
    ),
    scoringVersion: raw.find((r) => r.scoring_version)?.scoring_version ?? null,
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
}

/**
 * Where a score sits against every other site we have measured.
 *
 * True, comparative and it cuts both ways, which is the only kind of pressure
 * worth applying: a D is worse when you can see twenty sites above it, and an
 * A is worth more when you can see how few there are.
 *
 * Null below ten scored sites. "Third of four" is not a standing, and dressing
 * a tiny sample up as one is the sort of thing this product exists to argue
 * against.
 */
export async function standingFor(total: number | null): Promise<Standing | null> {
  if (total === null) return null;
  const client = publicClient();

  const [better, scored, aGrade] = await Promise.all([
    client.from('chart_rows').select('site_id', { count: 'exact', head: true }).gt('total', total),
    client.from('chart_rows').select('site_id', { count: 'exact', head: true }).not('total', 'is', null),
    client.from('chart_rows').select('site_id', { count: 'exact', head: true }).eq('grade', 'A'),
  ]);

  const of = scored.count ?? 0;
  if (of < 10) return null;

  return { rank: (better.count ?? 0) + 1, of, atA: aGrade.count ?? 0 };
}
