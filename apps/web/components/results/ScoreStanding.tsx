import Link from 'next/link';

import type { Standing } from '@/lib/chart-data';
import { cx } from '@/components/ui';

/**
 * Where this site sits against every other one we have measured.
 *
 * The score alone is abstract — 51 out of 100 is a number somebody can talk
 * themselves out of. A position is not: twenty-three sites read better than
 * yours is a fact with a shape, and it is true, which is the only kind of
 * pressure worth applying. It cuts both ways on purpose. A D is worse for
 * being twenty-fourth, and an A is worth more for being one of three.
 *
 * Nothing here is invented. The rank is a count of sites scoring higher and
 * the page it links to shows every one of them.
 */
export function ScoreStanding({ standing, grade }: { standing: Standing | null; grade: string }) {
  if (!standing) return null;

  const top = grade.startsWith('A');
  const bad = grade.startsWith('D') || grade.startsWith('F');
  const ahead = standing.rank - 1;

  return (
    <Link
      href="/chart"
      className={cx(
        'edge mt-3 flex flex-wrap items-center gap-x-[10px] gap-y-1 rounded-[12px] px-[14px] py-[9px] font-mono text-[12.5px] no-underline',
        top ? 'bg-lime text-ink' : bad ? 'bg-coral text-ink' : 'bg-canvas text-ink',
      )}
    >
      <span className="font-bold">
        {ordinal(standing.rank)} of {standing.of}
      </span>
      <span className={top ? 'text-ink' : bad ? 'text-ink' : 'text-subtle-2'}>
        {top
          ? `one of only ${standing.atA} at grade A`
          : ahead === 0
            ? 'nothing reads better than you yet'
            : `${ahead} ${ahead === 1 ? 'site reads' : 'sites read'} better than yours`}
      </span>
    </Link>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
