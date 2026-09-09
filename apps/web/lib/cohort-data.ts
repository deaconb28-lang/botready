import { cohortStanding, type CohortStanding, type CohortStats } from '@botready/core';

import { publicClient } from './supabase';

/**
 * The cohort a score is read against.
 *
 * One row out of `cohort_medians`, which the database groups by profile and by
 * scoring version. Both halves of that key matter: the profile decides which
 * checks were counted, and the version decides which catalog counted them, so
 * a median is only a comparison when both match the score being compared.
 *
 * Returns null on any failure rather than throwing. A result page that cannot
 * reach this simply does not print the sentence, which is the same thing it
 * does when the cohort is too thin — and much better than a page that 500s
 * because a comparison was unavailable.
 */
export async function cohortFor(
  profile: string,
  scoringVersion: string,
  label: string,
): Promise<CohortStats | null> {
  try {
    const { data } = await publicClient()
      .from('cohort_medians')
      .select('profile, scored, median')
      .eq('profile', profile)
      .eq('scoring_version', scoringVersion)
      .maybeSingle();

    const row = data as { profile: string; scored: number; median: number } | null;
    if (!row) return null;
    return { profile: row.profile, label, count: row.scored, median: row.median };
  } catch {
    return null;
  }
}

/**
 * The sentence for a scan, or a standing with nothing to say.
 *
 * Named apart from chart-data's `standingFor`, which answers a different
 * question: that one ranks a site against every scored site, this one against
 * sites measured on the same checks. Both are on the result page and they are
 * not interchangeable — the global rank mixes a plumber and a CDN.
 */
export async function cohortStandingFor(
  total: number,
  profile: { key: string; label: string },
  scoringVersion: string,
): Promise<CohortStanding> {
  const stats = await cohortFor(profile.key, scoringVersion, cohortLabel(profile));
  return cohortStanding(total, stats);
}

/**
 * How a profile reads inside "the median for ___".
 *
 * The catalog's labels are titles — "Local service" — and the sentence wants a
 * noun phrase. Keyed on the profile key rather than on the label, because the
 * label is display copy somebody may reword and the key is the identifier; the
 * first version of this map was keyed on labels that had already drifted from
 * the catalog and silently fell through to the fallback.
 *
 * That fallback is the label lowercased, so a profile added to checks.json
 * without a line here still produces English rather than a gap.
 */
function cohortLabel(profile: { key: string; label: string }): string {
  const map: Record<string, string> = {
    'local-service': 'a local business',
    software: 'a software company',
    ecommerce: 'an online shop',
    media: 'a publisher',
    general: 'a site measured on every check',
  };
  return map[profile.key] ?? profile.label.toLowerCase();
}
