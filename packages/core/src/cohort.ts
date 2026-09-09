/**
 * What a score means next to the scores of comparable sites.
 *
 * "You scored 39" is a number. "You scored 39 where the median local business
 * scores 59" is information, and telling a bakery it ranks below Zapier is
 * neither. The three cohort medians in the last sweep were 74 for SaaS, 59.5
 * for north-Seattle local businesses and 54 for the general internet, which is
 * a wide enough spread that a single global ranking mostly measures which kind
 * of business a site is.
 *
 * The cohort is the scoring profile rather than a new taxonomy, and that is the
 * load-bearing decision here. A profile decides which checks a site was
 * measured on: `local-service` is exempt from API docs and an agent manifest,
 * `software` is not. Two sites in the same profile have the same denominator,
 * so their totals are on the same scale and a median across them means
 * something. A median across mixed profiles is an average of numbers built
 * from different check sets, which reads like a comparison and is not one.
 *
 * There are already two taxonomies in this repo — `sites.segment` for the
 * public index, `profiles` in checks.json for scoring — and 137 of 340 scored
 * sites have no segment at all. A third would have made it three.
 *
 * Constraint 2: pure, versioned, and no I/O. The median and the count are
 * measured by the database; what to say about them is decided here.
 */

export const COHORT_VERSION = '1.0';

/**
 * Below how many scored sites a cohort is not worth quoting.
 *
 * A median of three is an anecdote with a decimal point, and printing one
 * invites a reader to move their business on the strength of it. Twelve is the
 * smallest cohort in the current data (media) and is where this was set from,
 * so the rule is "the thinnest cohort we actually have, and nothing thinner".
 */
export const MIN_COHORT = 12;

export interface CohortStats {
  /** The scoring profile these were all measured under. */
  profile: string;
  /** How it reads in a sentence: "a local business". */
  label: string;
  /** Scored sites in the cohort, this site included. */
  count: number;
  /** The middle score, rounded, or null when nothing has been scored. */
  median: number | null;
}

export interface CohortStanding {
  version: string;
  /** The sentence, or null when there is no honest one to say. */
  sentence: string | null;
  /** Where the site sits. Null when the cohort is too thin to place it. */
  standing: 'above' | 'at' | 'below' | null;
  /** Points between this score and the median, positive when above. */
  delta: number | null;
}

/**
 * The comparison, or nothing.
 *
 * Nothing is returned in three cases and each of them matters. A cohort under
 * MIN_COHORT is too thin to quote. A cohort of one is this site on its own,
 * which would print "the median is your own score" and read as a compliment. A
 * missing median means nothing has been scored in this profile under this
 * version yet — which is the normal state for a day or two after a scoring
 * version ships, because a median has to be computed within a version or it
 * compares totals built from different catalogs.
 */
export function cohortStanding(total: number, stats: CohortStats | null): CohortStanding {
  const none: CohortStanding = { version: COHORT_VERSION, sentence: null, standing: null, delta: null };
  if (!stats || stats.median === null) return none;
  if (stats.count < MIN_COHORT) return none;

  const delta = total - stats.median;
  const standing = delta > 0 ? 'above' : delta < 0 ? 'below' : 'at';

  const where =
    standing === 'at'
      ? `exactly the median for ${stats.label}`
      : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'point' : 'points'} ${standing} the median for ${stats.label}`;

  return {
    version: COHORT_VERSION,
    // The count is part of the sentence rather than a footnote, because a
    // median is only as good as what it was taken over and the reader is
    // entitled to weigh it.
    sentence: `You scored ${total}, ${where}, taken from ${stats.count} scored sites.`,
    standing,
    delta,
  };
}
