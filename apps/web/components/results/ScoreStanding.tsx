import Link from 'next/link';

import type { Standing } from '@/lib/chart-data';
import { cx } from '@/components/ui';

/**
 * Where this site sits against every other one we have measured.
 *
 * The score alone is abstract — 51 out of 100 is a number somebody can talk
 * themselves out of. A position is not: thirty-nine sites read better than
 * yours is a fact with a shape, and it is true, which is the only kind of
 * pressure worth applying. It cuts both ways on purpose. A D is worse for
 * being fortieth, and an A is worth more for being one of three.
 *
 * Two rows and a base. The second row is the one that matters: a rank on its
 * own is a scolding about the past, while "two points clears two sites" is the
 * same fact pointed at something the reader can do this afternoon, with the
 * name of the site they would pass. That is the whole difference between loss
 * aversion that works and loss aversion that just feels bad.
 *
 * The field runs along the card's bottom edge rather than in a row of its own.
 * It had a track, two end labels and the padding to hold them, which is a lot
 * of furniture for one marker.
 *
 * Nothing here is invented. Every number is a count of rows on the page this
 * links to, and the marker sits where the arithmetic puts it.
 */
export function ScoreStanding({ standing, grade }: { standing: Standing | null; grade: string }) {
  if (!standing) return null;

  const top = grade.startsWith('A');
  const bad = grade.startsWith('D') || grade.startsWith('F');
  const ahead = standing.rank - 1;

  // 1st sits at the left edge, last at the right. Clamped off both ends so the
  // marker is never half outside the track it belongs to.
  const position = standing.of <= 1 ? 0 : ((standing.rank - 1) / (standing.of - 1)) * 100;
  const clamped = Math.min(94, Math.max(2, position));

  const ground = top ? 'bg-lime' : bad ? 'bg-coral' : 'bg-amber';

  return (
    <section className={cx('edge mt-3 overflow-hidden rounded-[14px] shadow-hard-3', ground)}>
      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1 px-[14px] pb-[9px] pt-[10px] font-mono text-[12.5px] text-ink">
        <span className="display text-[16px] font-bold leading-none">
          {ordinal(standing.rank)} of {standing.of}
        </span>
        <span>
          {top
            ? `one of only ${standing.atA} at grade A`
            : ahead === 1
              ? 'one site reads better than yours'
              : `${ahead} sites read better than yours`}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-2 border-ink bg-white/45 px-[14px] py-[9px] font-mono text-[12px] text-ink">
        <span>
          {standing.gap === null || standing.nextUp === null ? (
            'Nothing reads better than yours.'
          ) : (
            <>
              <span className="font-bold">
                +{standing.gap} {standing.gap === 1 ? 'point' : 'points'}
              </span>{' '}
              clears {standing.clears} {standing.clears === 1 ? 'site' : 'sites'}, starting with{' '}
              <span className="font-bold">{standing.nextUp.domain}</span> at {standing.nextUp.total}.
            </>
          )}
        </span>
        <Link href="/chart" className="whitespace-nowrap font-bold text-ink underline underline-offset-2">
          See the chart
        </Link>
      </div>

      {/* The field, as the card's own base rather than a padded row of its
          own. It had a track, two end labels and the vertical space to hold
          them, which is a lot of furniture for one marker — and with the rank
          written above it, nothing needed telling which end was which. */}
      <div className="relative h-[9px] border-t-2 border-ink bg-white" aria-hidden="true">
        <span
          className="absolute -top-[1px] h-[9px] w-[12px] border-x-2 border-ink bg-ink"
          style={{ left: `calc(${clamped}% - 6px)` }}
        />
      </div>
    </section>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
