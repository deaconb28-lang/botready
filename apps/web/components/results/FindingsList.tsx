'use client';

import { useState } from 'react';

import type { Finding } from '@botready/core';

import { copyFor } from '@/lib/finding-copy';
import { useMode } from '@/lib/mode';
import { COPY } from '@/lib/copy';
import { SeverityDot, cx } from '@/components/ui';

export interface FindingItem {
  finding: Finding;
  observed: Record<string, unknown>;
}

/**
 * The findings, ordered by effort. One disclosure open at a time. The raw
 * request and response sits under "Show details" in a dark block.
 *
 * `variant` picks the marketing (violet fix chip, no shadow) or app (lime fix
 * chip, hard shadow) treatment; the content is identical.
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
  const [open, setOpen] = useState(-1);

  if (items.length === 0) {
    return (
      <div className="edge rounded-[18px] bg-white p-[22px]">
        <h2 className="display text-[18px] font-semibold">Every check passed</h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-muted">There is nothing to fix. Re-run the check after your next deploy to make sure it stays that way.</p>
      </div>
    );
  }

  const first = items.slice(0, 2).reduce((s, i) => s + i.finding.pointsLost, 0);

  return (
    <div>
      {variant === 'site' ? (
        <>
          <h2 className="display mb-[6px] text-[26px] tracking-[-0.025em]">{copy.findingsTitle}</h2>
          <p className="mb-[18px] text-[15.5px] leading-[1.55] text-muted">
            {mode === 'tech'
              ? `${pointsMissing} points unearned across ${items.length} ${items.length === 1 ? 'check' : 'checks'}, ordered by effort rather than by points.`
              : items.length >= 2
                ? `Start at the top. The first two items are worth ${first} of the ${pointsMissing} points you're missing.`
                : `One item, worth ${pointsMissing} of the points you're missing.`}
          </p>
        </>
      ) : null}
      <ul className="m-0 grid list-none gap-3 p-0">
        {items.map((item, i) => {
          const c = copyFor(item.finding, item.observed, mode);
          const isOpen = open === i;
          const severity = item.finding.status === 'error' ? 'error' : item.finding.status === 'warn' ? 'warn' : 'fail';
          return (
            <li key={item.finding.key} className={cx('edge rounded-[18px] bg-white', variant === 'app' ? 'px-[22px] py-5 shadow-hard-3' : 'p-[22px]')}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-[11px]">
                  <SeverityDot severity={severity} size={variant === 'app' ? 12 : 9} />
                  <h3 className={cx('display text-[18px]', variant === 'app' ? 'font-bold' : 'font-semibold')}>{c.title}</h3>
                </div>
                <span className={cx('font-mono text-[11.5px]', variant === 'app' ? 'font-medium text-subtle' : 'text-placeholder')}>{c.points}</span>
              </div>
              <p className={cx('mt-[10px] text-[15px] leading-[1.6]', variant === 'app' ? 'pl-6 text-body' : 'pl-[21px] text-muted')}>{c.body}</p>
              <div className={cx('mt-[14px] flex flex-wrap items-center gap-3', variant === 'app' ? 'pl-6' : 'pl-[21px]')}>
                <span
                  className={cx(
                    'rounded-[8px] px-[10px] py-[5px] font-mono text-[12px] font-medium',
                    variant === 'app' ? 'edge bg-lime text-ink' : 'bg-violet-chip text-violet',
                  )}
                >
                  {c.fix}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`finding-${item.finding.key}`}
                  className={cx(
                    'cursor-pointer border-0 bg-transparent p-0 font-body text-[13.5px] underline underline-offset-[3px]',
                    variant === 'app' ? 'font-semibold text-violet' : 'font-medium text-muted',
                  )}
                >
                  {isOpen ? 'Hide details' : 'Show details'}
                </button>
              </div>
              {isOpen ? (
                <pre
                  id={`finding-${item.finding.key}`}
                  className={cx(
                    'anim-rise-fast mt-[14px] overflow-auto rounded-[14px] bg-ink p-[18px] font-mono text-[12.5px] leading-[1.75]',
                    variant === 'app' ? 'ml-6 text-on-ink-3' : 'ml-[21px] text-on-ink',
                  )}
                >
                  {c.detail}
                </pre>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
