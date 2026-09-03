/**
 * The six category cards, each with a ten-segment meter.
 *
 * The weight is printed on every card because the weights are published, and a
 * subscore without its weight is a number with no units. Arguing about the
 * weights in public is free marketing, which only works if they are visible.
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

export function CategoryCards({ categories }: { categories: CategoryBreakdown[] }) {
  // One column on a phone, three on a desktop, matching the mockup's two frames.
  return (
    <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.key} category={category} />
      ))}
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryBreakdown }) {
  const measured = category.available > 0;
  const tone = scoreTone(category.score);

  return (
    <section className="rounded-[6px] border border-rule bg-card px-[18px] py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-body text-[14.5px] font-semibold">
          <Link href={`/what-we-check#${category.key}`} className="hover:underline">
            {category.label}
          </Link>
        </h3>
        <span
          className={`font-data text-[15px] font-bold ${measured ? VALUE_COLOUR[tone] : 'text-ink-60'}`}
        >
          {measured ? category.score : '—'}
        </span>
      </div>

      <p className="mt-0.5 font-data text-[11px] text-ink-60">
        weight {category.weight}%
        {measured ? (
          <>
            {' · '}
            {category.earned % 1 === 0 ? category.earned : category.earned.toFixed(1)} of{' '}
            {category.available} points
          </>
        ) : (
          ' · nothing measured'
        )}
      </p>

      <div className="mt-3">
        {measured ? (
          <Meter value={category.score} segments={10} tone={tone} label={category.label} />
        ) : (
          <div className="flex gap-[2px]" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className="block h-2 flex-1 rounded-[1px] bg-rule" />
            ))}
          </div>
        )}
      </div>

      {!measured ? (
        <p className="mt-2 font-data text-micro text-ink-60">
          Every check here was skipped, so this category&rsquo;s {category.weight}% was shared out
          across the rest rather than counted as a zero.
        </p>
      ) : null}
    </section>
  );
}
