/**
 * Scoring. Pure, versioned, no I/O, and no imports outside packages/core.
 *
 * The scanner emits observations. This turns observations into a number. The
 * two are apart so that changing a weight is a re-score of history rather than
 * a re-crawl of the internet, and so that nothing in the crawler has an opinion
 * about how bad a finding is.
 *
 * The rules, in one place:
 *
 *   pass   full points
 *   warn   half points. Amber means partial credit everywhere in this product,
 *          and the colour maps to 3xx for the same reason.
 *   fail   zero points, counted in the denominator
 *   error  zero points, counted in the denominator, listed separately so the
 *          interface can say the check could not run instead of implying the
 *          site failed it
 *   skip   removed from the denominator entirely
 *
 *   A check with no result at all is treated as a skip. That is deliberate:
 *   when a check is added to the catalog, scans that ran before it existed are
 *   not retroactively penalised for it.
 *
 *   A category where everything was skipped has its weight redistributed across
 *   the categories that did produce results, which is the same rule one level up.
 */

import { CURRENT_SCORING_VERSION, catalogFor } from './catalog';
import type {
  CategoryKey,
  CheckResult,
  CheckStatus,
  Grade,
  ScanScore,
} from './types';

/** Amber is partial credit. One constant, not a magic number in a branch. */
export const WARN_CREDIT = 0.5;

const CREDIT: Record<Exclude<CheckStatus, 'skip'>, number> = {
  pass: 1,
  warn: WARN_CREDIT,
  fail: 0,
  error: 0,
};

export interface CategoryBreakdown {
  key: CategoryKey;
  label: string;
  weight: number;
  /** 0 to 100, rounded for display. */
  score: number;
  /** Points credited, before rounding. */
  earned: number;
  /** Points that were in play: catalog points minus anything skipped. */
  available: number;
  checks: Array<{ key: string; status: CheckStatus; points: number }>;
}

export interface ScoreDetail extends ScanScore {
  categories: CategoryBreakdown[];
}

/**
 * The contract function. Same input, same output, forever, for a given version.
 */
export function score(results: CheckResult[], version?: string): ScanScore {
  const { categories, ...rest } = scoreDetail(results, version);
  void categories;
  return rest;
}

/**
 * Everything `score` returns, plus the per-category arithmetic the result page
 * needs to draw the ten-segment meters and the findings list.
 */
export function scoreDetail(results: CheckResult[], version?: string): ScoreDetail {
  const cat = catalogFor(version);
  const scoringVersion = version ?? cat.scoringVersion ?? CURRENT_SCORING_VERSION;

  // Last result wins if a key somehow appears twice. Evidence has a unique
  // (scan_id, check_key) constraint, so this only bites on synthetic input.
  const byKey = new Map<string, CheckResult>();
  for (const r of results) byKey.set(r.key, r);

  const failedChecks: string[] = [];
  const erroredChecks: string[] = [];
  const skippedChecks: string[] = [];

  const breakdowns: CategoryBreakdown[] = cat.categories.map((category) => {
    const checks = cat.checks.filter((c) => c.category === category.key);
    let earned = 0;
    let available = 0;
    const seen: CategoryBreakdown['checks'] = [];

    for (const def of checks) {
      const result = byKey.get(def.key);
      const status: CheckStatus = result?.status ?? 'skip';
      seen.push({ key: def.key, status, points: def.points });

      if (status === 'skip') continue;
      available += def.points;
      earned += def.points * CREDIT[status];
    }

    return {
      key: category.key,
      label: category.label,
      weight: category.weight,
      score: available === 0 ? 0 : round(percent(earned, available)),
      earned,
      available,
      checks: seen,
    };
  });

  // Classify once, over the whole catalog, so the lists are stable in catalog
  // order rather than in whatever order the worker happened to emit.
  for (const def of cat.checks) {
    const status = byKey.get(def.key)?.status ?? 'skip';
    if (status === 'fail') failedChecks.push(def.key);
    else if (status === 'error') erroredChecks.push(def.key);
    else if (status === 'skip') skippedChecks.push(def.key);
  }

  // Keys that arrived but are not in this catalog are ignored, not counted.
  // A test asserts the scanner never emits one; this keeps a stray row from a
  // retired check out of the arithmetic instead of throwing on read.

  const scoring = breakdowns.filter((b) => b.available > 0);
  const weightInPlay = scoring.reduce((sum, b) => sum + b.weight, 0);

  const total =
    weightInPlay === 0
      ? 0
      : round(
          scoring.reduce((sum, b) => sum + b.weight * percent(b.earned, b.available), 0) /
            weightInPlay,
        );

  const categoryScores = Object.fromEntries(
    breakdowns.map((b) => [b.key, b.score]),
  ) as Record<CategoryKey, number>;

  return {
    total,
    grade: gradeFor(total, version),
    categoryScores,
    failedChecks,
    erroredChecks,
    skippedChecks,
    scoringVersion,
    categories: breakdowns,
  };
}

export function gradeFor(total: number, version?: string): Grade {
  const bands = [...catalogFor(version).grades].sort((a, b) => b.min - a.min);
  for (const band of bands) {
    if (total >= band.min) return band.grade;
  }
  // checks.json always carries a band with min 0, but the fallback keeps the
  // return type honest rather than asserting non-null.
  return 'F';
}

/**
 * How many points a check is worth in the final total, given the categories
 * that were actually in play. This is what the findings list prints as
 * "−18 pts", and it has to come from the same arithmetic as the total or the
 * numbers on the page will not add up.
 */
export function pointsLost(
  results: CheckResult[],
  key: string,
  version?: string,
): number {
  const cat = catalogFor(version);
  const def = cat.checks.find((c) => c.key === key);
  if (!def) return 0;

  const detail = scoreDetail(results, version);
  const breakdown = detail.categories.find((b) => b.key === def.category);
  if (!breakdown || breakdown.available === 0) return 0;

  const status = results.find((r) => r.key === key)?.status ?? 'skip';
  if (status === 'skip' || status === 'pass') return 0;

  const weightInPlay = detail.categories
    .filter((b) => b.available > 0)
    .reduce((sum, b) => sum + b.weight, 0);
  if (weightInPlay === 0) return 0;

  const uncredited = def.points * (1 - (CREDIT[status] ?? 0));
  const share = (breakdown.weight / weightInPlay) * (100 / breakdown.available);
  return round(uncredited * share);
}

function percent(earned: number, available: number): number {
  return (earned / available) * 100;
}

/**
 * Half away from zero, not JavaScript's half-up-toward-positive-infinity, so
 * the total is stable regardless of platform float printing. Totals are always
 * non-negative here, but the symmetry costs nothing and removes a footgun.
 */
function round(n: number): number {
  const r = Math.round(Math.abs(n) * 1e6) / 1e6;
  return Math.sign(n) * Math.round(r);
}
