/**
 * A score next to comparable scores.
 *
 * The medians in the last sweep were 74 for SaaS, 59.5 for north-Seattle local
 * businesses and 54 for the general internet — a spread wide enough that a
 * single global ranking mostly measures which kind of business a site is.
 * Telling a bakery it ranks below Zapier is not information.
 *
 * Most of what is asserted here is when the comparison refuses to appear. A
 * median quoted from too few sites is an anecdote with a decimal point, and it
 * is the kind of number a reader would act on.
 */

import { describe, expect, it } from 'vitest';

import { COHORT_VERSION, MIN_COHORT, cohortStanding, type CohortStats } from '../src/cohort';

const stats = (over: Partial<CohortStats> = {}): CohortStats => ({
  profile: 'local-service',
  label: 'a local business',
  count: 44,
  median: 59,
  ...over,
});

describe('the cohort comparison', () => {
  it('places a score above the median', () => {
    const s = cohortStanding(72, stats());
    expect(s.standing).toBe('above');
    expect(s.delta).toBe(13);
    expect(s.sentence).toBe('You scored 72, 13 points above the median for a local business, taken from 44 scored sites.');
  });

  it('places a score below it', () => {
    const s = cohortStanding(39, stats());
    expect(s.standing).toBe('below');
    expect(s.delta).toBe(-20);
    expect(s.sentence).toContain('20 points below the median for a local business');
  });

  it('says exactly the median rather than nought points from it', () => {
    const s = cohortStanding(59, stats());
    expect(s.standing).toBe('at');
    expect(s.sentence).toBe('You scored 59, exactly the median for a local business, taken from 44 scored sites.');
  });

  it('says point rather than points at one', () => {
    expect(cohortStanding(60, stats()).sentence).toContain('1 point above');
  });

  it('carries the count in the sentence rather than in a footnote', () => {
    // A median is only as good as what it was taken over, and the reader is
    // entitled to weigh it without hunting.
    expect(cohortStanding(72, stats({ count: 13 })).sentence).toContain('from 13 scored sites');
  });

  it('carries its own version', () => {
    expect(cohortStanding(72, stats()).version).toBe(COHORT_VERSION);
  });

  describe('says nothing rather than something thin', () => {
    it('refuses a cohort under the minimum', () => {
      const s = cohortStanding(72, stats({ count: MIN_COHORT - 1 }));
      expect(s.sentence).toBeNull();
      expect(s.standing).toBeNull();
      expect(s.delta).toBeNull();
    });

    it('takes the minimum itself', () => {
      expect(cohortStanding(72, stats({ count: MIN_COHORT })).sentence).not.toBeNull();
    });

    it('refuses a cohort of one, which is the site looking at itself', () => {
      // Would otherwise print "exactly the median", which reads as a
      // compliment and is arithmetic about a single row.
      expect(cohortStanding(72, stats({ count: 1, median: 72 })).sentence).toBeNull();
    });

    it('refuses when nothing has been scored in this profile and version', () => {
      // The normal state for a day or two after a scoring version ships: a
      // median has to be computed within a version, or it compares totals
      // built from different catalogs.
      expect(cohortStanding(72, stats({ median: null })).sentence).toBeNull();
      expect(cohortStanding(72, null).sentence).toBeNull();
    });

    it('refuses rather than throwing on a zero median', () => {
      // Zero is a real median, not a missing one, so this must still speak.
      expect(cohortStanding(40, stats({ median: 0 })).sentence).toContain('40 points above');
    });
  });
});
