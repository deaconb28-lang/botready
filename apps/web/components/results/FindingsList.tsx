'use client';

import { useState } from 'react';

import { CATEGORY_KEYS, categoryDef, type CategoryKey, type Finding } from '@botready/core';

import { copyFor } from '@/lib/finding-copy';
import { useMode } from '@/lib/mode';
import { COPY } from '@/lib/copy';
import { CATEGORY_PAINT } from '@/lib/theme';
import { SeverityDot, cx } from '@/components/ui';

export interface FindingItem {
  finding: Finding;
  observed: Record<string, unknown>;
}

interface Group {
  key: CategoryKey;
  label: string;
  items: FindingItem[];
  points: number;
}

/**
 * Everything that did not pass, in one block per category.
 *
 * This used to be a flat list of full-height cards, each carrying a heading, a
 * three-sentence paragraph and two controls. Seventeen of those is four
 * screens of prose before the reader reaches anything else on the page, and
 * the prose is the part they read last: what they want first is how many
 * things are wrong and where. So the block is the unit now — six of them at
 * most — and each finding inside is one line until it is opened.
 *
 * Nothing was cut. Every sentence that was on the page is still on the page,
 * one click away, and the evidence is where it always was underneath it.
 *
 * `variant` picks the marketing (violet fix chip) or app (lime fix chip)
 * treatment; the content is identical.
 */
export function FindingsList({
  items,
  pointsMissing,
  variant = 'site',
}: {
  items: FindingItem[];
  pointsMissing: number;
  variant?: 'site' | 'app';
}) {
  const { mode } = useMode();
  const copy = COPY[mode];
  const [open, setOpen] = useState('');

  if (items.length === 0) {
    return (
      <div className="edge rounded-[18px] bg-white p-[22px]">
        <h2 className="display text-[18px] font-semibold">Every check passed</h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-muted">There is nothing to fix. Re-run the check after your next deploy to make sure it stays that way.</p>
      </div>
    );
  }

  const groups = groupByCategory(items);
  // `items` is non-empty by the guard above, so grouping produced at least one.
  const worst = groups[0] as Group;

  return (
    <div>
      {variant === 'site' ? (
        <>
          <h2 className="display mb-[6px] text-[26px] tracking-[-0.025em]">{copy.findingsTitle}</h2>
          <p className="mb-[18px] text-[15.5px] leading-[1.55] text-muted">
            {mode === 'tech'
              ? `${pointsMissing} points unearned across ${items.length} ${items.length === 1 ? 'check' : 'checks'} in ${groups.length} ${groups.length === 1 ? 'category' : 'categories'}, grouped by category and ordered by points.`
              : groups.length === 1
                ? `${countWord(items.length)} in one place. Open any line to see what we measured.`
                : `${worst.label} is costing you the most — ${worst.points} of the ${pointsMissing} points you're missing. Open any line to see what we measured.`}
          </p>
        </>
      ) : null}

      <div className="grid gap-[14px]">
        {groups.map((group) => (
          <CategoryBlock key={group.key} group={group} open={open} setOpen={setOpen} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function CategoryBlock({
  group,
  open,
  setOpen,
  variant,
}: {
  group: Group;
  open: string;
  setOpen: (key: string) => void;
  variant: 'site' | 'app';
}) {
  const paint = CATEGORY_PAINT[group.key];
  return (
    <section className={cx('edge overflow-hidden rounded-[18px] bg-white', variant === 'app' ? 'shadow-hard-3' : '')}>
      <div className="flex items-center gap-3 border-b-2 border-ink px-[18px] py-[11px]" style={{ background: paint.tint }}>
        <span aria-hidden="true" className="h-[13px] w-[13px] shrink-0 rounded-full border-2 border-ink" style={{ background: paint.color }} />
        <h3 className="display min-w-0 flex-1 truncate text-[16px] font-semibold">{group.label}</h3>
        <span className="shrink-0 font-mono text-[11.5px] font-medium text-ink">
          −{group.points} {group.points === 1 ? 'pt' : 'pts'}
        </span>
      </div>

      <ul className="m-0 list-none p-0">
        {group.items.map((item, i) => (
          <FindingRow
            key={item.finding.key}
            item={item}
            first={i === 0}
            isOpen={open === item.finding.key}
            onToggle={() => setOpen(open === item.finding.key ? '' : item.finding.key)}
            variant={variant}
          />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({
  item,
  first,
  isOpen,
  onToggle,
  variant,
}: {
  item: FindingItem;
  first: boolean;
  isOpen: boolean;
  onToggle: () => void;
  variant: 'site' | 'app';
}) {
  const { mode } = useMode();
  const c = copyFor(item.finding, item.observed, mode);
  const severity = item.finding.status === 'error' ? 'error' : item.finding.status === 'warn' ? 'warn' : 'fail';
  const panelId = `finding-${item.finding.key}`;

  return (
    <li className={cx(first ? '' : 'border-t border-hairline-2', isOpen ? 'bg-surface-alt' : '')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-center gap-[11px] border-0 bg-transparent px-[18px] py-[13px] text-left"
      >
        <SeverityDot severity={severity} size={9} />
        <span className={cx('display min-w-0 flex-1 text-[15.5px]', variant === 'app' ? 'font-bold' : 'font-semibold')}>{c.title}</span>
        <span
          className={cx(
            'hidden shrink-0 rounded-[8px] px-[9px] py-[4px] font-mono text-[11.5px] font-medium sm:inline-block',
            variant === 'app' ? 'edge bg-lime text-ink' : 'bg-violet-chip text-violet',
          )}
        >
          {c.fix}
        </span>
        <span className="w-[42px] shrink-0 text-right font-mono text-[11.5px] text-placeholder">{c.points}</span>
        <span aria-hidden="true" className={cx('shrink-0 transition-transform duration-150', isOpen ? 'rotate-180' : '')}>
          <svg viewBox="0 0 12 8" className="h-[8px] w-[12px]">
            <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-subtle-2" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div id={panelId} className="anim-rise-fast px-[18px] pb-[18px] pl-[38px]">
          <p className={cx('text-[15px] leading-[1.6]', variant === 'app' ? 'text-body' : 'text-muted')}>{c.body}</p>
          {/* The fix chip is the one thing the collapsed row drops on a phone,
              so it comes back here rather than being lost at that width. */}
          <span
            className={cx(
              'mt-[12px] inline-block rounded-[8px] px-[10px] py-[5px] font-mono text-[12px] font-medium sm:hidden',
              variant === 'app' ? 'edge bg-lime text-ink' : 'bg-violet-chip text-violet',
            )}
          >
            {c.fix}
          </span>
          <pre className={cx('mt-[14px] overflow-auto rounded-[14px] bg-ink p-[18px] font-mono text-[12.5px] leading-[1.75]', variant === 'app' ? 'text-on-ink-3' : 'text-on-ink')}>
            {c.detail}
          </pre>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Categories worst-first, and inside each one the order the findings arrived
 * in, which is the effort order the list was already sorted into. A tie between
 * two categories is broken by the catalog's own order rather than by chance, so
 * the same result always draws the same page.
 */
function groupByCategory(items: FindingItem[]): Group[] {
  const groups = new Map<CategoryKey, Group>();

  for (const item of items) {
    const key = item.finding.category;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: categoryDef(key)?.label ?? key, items: [], points: 0 };
      groups.set(key, group);
    }
    group.items.push(item);
    group.points += item.finding.pointsLost;
  }

  return [...groups.values()].sort(
    (a, b) => b.points - a.points || CATEGORY_KEYS.indexOf(a.key) - CATEGORY_KEYS.indexOf(b.key),
  );
}

function countWord(n: number): string {
  return n === 1 ? 'One thing to fix' : `${n} things to fix`;
}
