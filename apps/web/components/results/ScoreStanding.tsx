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
 * Three rows, and the third is the one that matters. A rank on its own is a
 * scolding about the past; "four points clears three sites" is the same fact
 * pointed at something the reader can do this afternoon, with the name of the
 * site they would pass. That is the whole difference between loss aversion
 * that works and loss aversion that just feels bad.
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
      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1 border-b-2 border-ink px-[14px] py-[10px] font-mono text-[12.5px] text-ink">
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

      {/* The whole field, with the reader on it. A rank is a number; this is
          the number's shape, and it is the part somebody sees before reading. */}
      <div className="px-[14px] pb-[10px] pt-[12px]">
        <div className="relative h-[8px] rounded-full border-2 border-ink bg-white">
          <span
            aria-hidden="true"
            className="absolute -top-[4px] h-[14px] w-[10px] rounded-[3px] border-2 border-ink bg-ink"
            style={{ left: `${clamped}%` }}
          />
        </div>
        <div className="mt-[6px] flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink/70">
          <span>Best</span>
          <span>Worst</span>
        </div>
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
    </section>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
