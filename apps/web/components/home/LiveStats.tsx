import Link from 'next/link';

import { loadPublicStats } from '@/lib/stats';
import { Eyebrow } from '@/components/ui';

/**
 * The corpus, as four numbers.
 *
 * Real social proof for a product with no testimonials yet, and better than
 * testimonials would be: every figure is a count of rows on /chart, which is
 * public, so the claim and its evidence are one click apart. The link is not
 * decoration — a number a reader cannot check is a number they are being asked
 * to take on faith, and this whole product is an argument against that.
 *
 * Renders nothing when loadPublicStats returns null, which is a corpus too
 * small to mean anything or a query that failed. Both cases are better served
 * by an absent section than by a hedge.
 */
export async function LiveStats() {
  const stats = await loadPublicStats();
  if (!stats) return null;

  const tiles: Array<{ n: string; label: string; tone?: 'coral' }> = [
    { n: String(stats.checked), label: 'sites checked so far' },
    { n: `${stats.averageScore}`, label: 'average score out of 100' },
    ...(stats.poorOneIn
      ? [{ n: `1 in ${stats.poorOneIn}`, label: 'scores a D or worse', tone: 'coral' as const }]
      : []),
    ...(stats.refused > 0
      ? [{ n: String(stats.refused), label: 'refused our crawler outright', tone: 'coral' as const }]
      : []),
  ];

  return (
    <section className="edge mt-12 rounded-[18px] bg-white p-[26px] shadow-hard-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <Eyebrow>What we have found so far</Eyebrow>
        <Link href="/chart" className="font-mono text-[12.5px] font-bold text-ink underline underline-offset-2">
          Check every number on the chart
        </Link>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt className="sr-only">{tile.label}</dt>
            <dd
              className={
                tile.tone === 'coral'
                  ? 'display m-0 text-[clamp(30px,4vw,42px)] leading-none tracking-[-0.03em] text-coral-text'
                  : 'display m-0 text-[clamp(30px,4vw,42px)] leading-none tracking-[-0.03em] text-ink'
              }
            >
              {tile.n}
            </dd>
            <dd className="m-0 mt-[9px] text-[13.5px] leading-[1.4] text-muted">{tile.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
