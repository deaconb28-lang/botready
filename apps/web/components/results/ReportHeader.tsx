'use client';

import { useEffect, useRef, useState } from 'react';

import { useMode } from '@/lib/mode';
import { SoftChip, ThinBar, cx } from '@/components/ui';
import { barColorFor } from '@/lib/theme';

export interface CategoryCell {
  key: string;
  label: string;
  pct: number;
}

const COUNT_MS = 1500;

/**
 * The report header. The score counts up over 1500ms with a cubic ease-out on
 * requestAnimationFrame, plus a setTimeout(dur + 250) that unconditionally
 * writes the final score, because rAF is paused in a hidden tab and the number
 * would otherwise stick at 0 forever.
 */
export function ReportHeader({
  total,
  grade,
  scoringVersion,
  summaryPlain,
  summaryTech,
  categories,
  action,
  animate = true,
}: {
  total: number;
  grade: string;
  scoringVersion: string;
  summaryPlain: string;
  summaryTech: string;
  categories: CategoryCell[];
  action: React.ReactNode;
  animate?: boolean;
}) {
  const { mode } = useMode();
  const [fill, setFill] = useState(animate ? 0 : total);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setFill(total);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setFill(total);
      return;
    }
    const start = performance.now();
    const finish = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      setFill(total);
    };
    const timer = setTimeout(finish, COUNT_MS + 250);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setFill(total * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else finish();
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      clearTimeout(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [total, animate]);

  const healthy = grade.startsWith('A') || grade.startsWith('B');

  return (
    <div className="edge mt-[18px] overflow-hidden rounded-[24px] bg-white">
      <div className="flex flex-wrap items-center gap-8 border-b border-hairline px-6 py-[30px] sm:px-8">
        <div className="flex items-baseline gap-3">
          <span className="display-tight text-[64px] leading-none tracking-[-0.04em] tabular-nums" aria-live="off">
            {Math.round(fill)}
          </span>
          <span className="font-mono text-[14px] text-subtle-2">/ 100</span>
          <span className="sr-only">{total} out of 100</span>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-[10px]">
            <SoftChip tone={healthy ? 'ok' : 'bad'} className="font-body text-[12.5px] font-semibold">
              Grade {grade}
            </SoftChip>
            <span className="font-mono text-[12.5px] text-subtle-2">scoring v{scoringVersion}</span>
          </div>
          <p className="mt-[10px] max-w-[46ch] text-[15.5px] leading-[1.5] text-muted">{mode === 'tech' ? summaryTech : summaryPlain}</p>
        </div>
        {action}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {categories.map((c) => (
          <div key={c.key} className={cx('border-b border-r border-hairline px-6 py-5')}>
            <div className="font-body text-[13px] font-medium text-muted">{c.label}</div>
            <div className="display mb-2 mt-[6px] text-[24px]">{c.pct}%</div>
            <ThinBar pct={c.pct} color={barColorFor(c.pct)} />
          </div>
        ))}
      </div>
    </div>
  );
}
