import type { IndexRow } from '@/lib/index-data';

/**
 * The four figures the corpus strip shows, derived from the rows rather than
 * carried beside them.
 *
 * The direction matters. A ratio is computed from a count, never a count from a
 * rounded ratio — "1 in 4" is a rendering of `poor / scored`, so the headline
 * and the number under it cannot drift apart. On a page whose whole argument is
 * that the numbers are measured, a published figure inferred from a rounding
 * would be the exact failure mode we sell against.
 */
export interface CorpusStats {
  /** Every site in the corpus, scored or refused. */
  sites: number;
  /** Sites that produced a score. Refused sites have none, so averages use this. */
  scored: number;
  /** Mean total across scored sites, rounded. Null when nothing scored. */
  averageScore: number | null;
  /** Scored sites graded D or F. */
  poor: number;
  /** Sites that refused the crawler outright. */
  refused: number;
}

/** "1 in 4". Null when the ratio is not worth rounding to a small denominator. */
export function oneInPhrase(part: number, whole: number): string | null {
  if (whole <= 0 || part <= 0) return null;
  const n = Math.round(whole / part);
  return n >= 2 && n <= 20 ? `1 in ${n}` : null;
}

export function corpusStats(rows: IndexRow[]): CorpusStats {
  const scoredRows = rows.filter((r) => r.total !== null);
  const total = scoredRows.reduce((sum, r) => sum + (r.total ?? 0), 0);

  return {
    sites: rows.length,
    scored: scoredRows.length,
    averageScore: scoredRows.length > 0 ? Math.round(total / scoredRows.length) : null,
    // D and F. `gradeIsHealthy` treats C as unhealthy too, which is right for a
    // grade tile but wrong here: "D or worse" is the claim, so it is the test.
    poor: scoredRows.filter((r) => r.grade === 'D' || r.grade === 'F').length,
    // A refusal is a status, not a low score. These sites are not in `scored`.
    refused: rows.filter((r) => r.status === 'blocked').length,
  };
}
