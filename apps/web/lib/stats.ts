import { publicClient } from './supabase';

/**
 * What the corpus says, for the landing page.
 *
 * This is the only social proof on the site that is worth anything, and it is
 * worth something precisely because it is not a testimonial: every number here
 * is a count of rows anybody can go and verify on /chart. Nothing is rounded in
 * our favour and nothing is attributed to a person who does not exist.
 *
 * Null below thirty scanned sites. "Two of our three sites score badly" is not
 * evidence of anything, and dressing a tiny sample up as a finding is the exact
 * move this product exists to argue against — the same reason standingFor
 * refuses to rank a site against a field of four.
 */
export interface PublicStats {
  /** Sites with a settled scan, which is what "checked" honestly means. */
  checked: number;
  /** Of those, the ones that produced a score. */
  ranked: number;
  /** Mean score across the ranked ones, rounded to a whole number. */
  averageScore: number;
  /** Sites at D or F. */
  poor: number;
  /** `4` when a quarter of ranked sites are poor, for "1 in 4". Null if none are. */
  poorOneIn: number | null;
  /** Sites whose edge refused BotreadyBot outright. */
  refused: number;
}

const MINIMUM = 30;

export async function loadPublicStats(): Promise<PublicStats | null> {
  try {
    const client = publicClient();
    const rows = () => client.from('chart_rows').select('site_id', { count: 'exact', head: true });

    const [all, scored, blocked, poor, totals] = await Promise.all([
      rows(),
      rows().not('total', 'is', null),
      rows().eq('status', 'blocked'),
      rows().in('grade', ['D', 'F']),
      client.from('chart_rows').select('total').not('total', 'is', null),
    ]);

    const checked = all.count ?? 0;
    const ranked = scored.count ?? 0;
    if (checked < MINIMUM || ranked === 0) return null;

    const scores = ((totals.data ?? []) as Array<{ total: number }>).map((r) => Number(r.total));
    if (scores.length === 0) return null;

    const poorCount = poor.count ?? 0;

    return {
      checked,
      ranked,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      poor: poorCount,
      // Rounded to the nearest whole "one in N", because "one in 4.25" is not a
      // sentence and rounding a ratio nobody quotes to a decimal is false
      // precision. Null when nothing scores badly, so the tile disappears
      // rather than reading "one in 0".
      poorOneIn: poorCount > 0 ? Math.round(ranked / poorCount) : null,
      refused: blocked.count ?? 0,
    };
  } catch {
    // The home page is the one page that must not fall over, and it does not
    // need this to do its job. A missing stat bar is a smaller problem than a
    // marketing page that 500s because a view was slow.
    return null;
  }
}
