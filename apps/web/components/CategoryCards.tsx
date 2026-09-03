/**
 * The six categories as one strip, not six cards.
 *
 * A row of columns separated by hairlines reads as one measurement with six
 * parts, which is what it is. The weight is printed under every score because
 * the weights are published, and a subscore without its weight is a number with
 * no units.
 */

import Link from 'next/link';

import type { CategoryBreakdown } from '@botready/core';

import { Meter, scoreTone } from './primitives';

/**
 * Written out rather than interpolated. Tailwind extracts class names by
 * reading the source, so `text-${tone}` produces no CSS at all and the number
 * silently loses its colour, which in this design is the number's meaning.
 */
const VALUE_COLOUR = {
  pass: 'text-pass',
  warn: 'text-warn',
  fail: 'text-fail',
} as const;

export function CategoryStrip({ categories }: { categories: CategoryBreakdown[] }) {
  return (
    <ol className="grid list-none grid-cols-2 gap-x-6 gap-y-7 border-y border-ink p-0 py-6 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-0 lg:gap-y-0">
      {categories.map((category) => (
        <li key={category.key} className="lg:border-l lg:border-rule lg:px-5 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
          <Category category={category} />
        </li>
      ))}
    </ol>
  );
}

function Category({ category }: { category: CategoryBreakdown }) {
  const measured = category.available > 0;
  const tone = scoreTone(category.score);

  return (
    <div>
      <p className="mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-60">
        <Link href={`/what-we-check#${category.key}`} className="hover:text-ink hover:underline">
          {category.label}
        </Link>
      </p>
      <p className={`display-section mt-2 text-[34px] ${measured ? VALUE_COLOUR[tone] : 'text-ink-60'}`}>
        {measured ? category.score : '—'}
      </p>
      <div className="mt-2.5">
        {measured ? (
          <Meter value={category.score} segments={10} tone={tone} label={category.label} height={6} />
        ) : (
          <div className="flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className="block h-[6px] flex-1 rounded-[1px] bg-rule" />
            ))}
          </div>
        )}
      </div>
      <p className="mono mt-2 text-[11px] text-ink-60">
        weight {category.weight}%
        {measured ? (
          <>
            {' · '}
            {category.earned % 1 === 0 ? category.earned : category.earned.toFixed(1)}/{category.available}
          </>
        ) : (
          ' · nothing measured'
        )}
      </p>
    </div>
  );
}
