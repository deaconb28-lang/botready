import Link from 'next/link';

import { Card, Eyebrow, cx } from '@/components/ui';
import { type CorpusStats, oneInPhrase } from '@/lib/corpus-stats';
import { formatInt } from '@/lib/theme';

/**
 * What the corpus has found so far, as a KPI row.
 *
 * Three decisions worth keeping. The sample size sits in the eyebrow rather
 * than beside the findings, because how many sites we checked is provenance and
 * not a result. Colour maps to state — amber for a middling average, coral for
 * the two failures — and every value carries a dot and a label as well, so the
 * state never rests on colour alone. And each of the three is a proportion, so
 * each gets a meter: the reader sees the magnitude instead of doing the
 * arithmetic, which is also what stops a small count like the refusals from
 * reading as though it were large.
 */

type Tone = 'warn' | 'bad';

const TONE = {
  warn: { fill: 'bg-amber', track: 'bg-amber-tint' },
  bad: { fill: 'bg-coral', track: 'bg-coral-tint' },
} satisfies Record<Tone, { fill: string; track: string }>;

function Meter({ pct, tone }: { pct: number; tone: Tone }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={cx('edge mt-4 h-[10px] overflow-hidden rounded-full', TONE[tone].track)}
      role="img"
      aria-label={`${Math.round(width)} percent`}
    >
      <div className={cx('h-full rounded-full', TONE[tone].fill)} style={{ width: `${width}%` }} />
    </div>
  );
}

function Stat({
  value,
  qualifier,
  label,
  pct,
  tone,
}: {
  value: string;
  qualifier: string;
  label: string;
  pct: number;
  tone: Tone;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-[10px]">
        {/* Proportional figures: tabular-nums gives every digit the width of a
            zero, which reads loose at display sizes. */}
        <span className="display-tight text-[clamp(40px,4.4vw,62px)] leading-none">{value}</span>
        <span className="display-tight text-[clamp(16px,1.6vw,23px)] text-subtle-2">{qualifier}</span>
      </div>
      <p className="mt-[11px] flex items-center gap-2 text-[15.5px] leading-[1.35] text-body">
        <span className={cx('edge inline-block size-[9px] shrink-0 rounded-full border', TONE[tone].fill)} />
        {label}
      </p>
      <Meter pct={pct} tone={tone} />
    </div>
  );
}

export function CorpusStrip({
  stats,
  href = '/index/saas',
  className = '',
}: {
  stats: CorpusStats;
  href?: string;
  className?: string;
}) {
  const { sites, scored, averageScore, poor, refused } = stats;

  // Nothing to report yet is not a strip full of zeroes.
  if (sites === 0 || averageScore === null) return null;

  const poorPhrase = oneInPhrase(poor, scored);

  return (
    <Card as="section" radius="panel-lg" shadow={5} className={cx('px-6 py-7 sm:px-10 sm:py-8', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Eyebrow>What we have found so far</Eyebrow>
        <Eyebrow>
          {formatInt(sites)} sites &middot; 21 checks each
        </Eyebrow>
      </div>

      <div className="mt-7 grid gap-x-11 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          value={String(averageScore)}
          qualifier="/ 100"
          label="average score"
          pct={averageScore}
          tone="warn"
        />
        <Stat
          value={poorPhrase ?? String(poor)}
          qualifier={poorPhrase ? `${formatInt(poor)} of ${formatInt(scored)}` : `of ${formatInt(scored)}`}
          label="score a D or worse"
          pct={scored > 0 ? (poor / scored) * 100 : 0}
          tone="bad"
        />
        <Stat
          value={String(refused)}
          qualifier={`of ${formatInt(sites)}`}
          label="refused our crawler outright"
          pct={sites > 0 ? (refused / sites) * 100 : 0}
          tone="bad"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Link href={href} className="font-mono text-[12.5px] text-violet underline underline-offset-[3px]">
          Check every number on the chart &rarr;
        </Link>
      </div>
    </Card>
  );
}
