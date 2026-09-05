'use client';

import { useEffect, useRef, useState } from 'react';

import { SoftChip, ThinBar, cx } from '@/components/ui';
import { GradeBot } from './GradeBot';
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
  summary,
  profileNote,
  verdict,
  categories,
  action,
  animate = true,
}: {
  total: number;
  grade: string;
  scoringVersion: string;
  summary: string;
  /** "Scored as a local service. 4 checks not counted." Null when nothing was. */
  profileNote?: string | null;
  /** For anything below an A: what it costs, revealed as the number lands. */
  verdict?: string | null;
  categories: CategoryCell[];
  action: React.ReactNode;
  animate?: boolean;
}) {
  const [fill, setFill] = useState(animate ? 0 : total);
  // The verdict lands a beat after the number stops, so the two are separate
  // events rather than one wall of text arriving at once.
  const [showVerdict, setShowVerdict] = useState(!animate);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setShowVerdict(true), COUNT_MS + 120);
    return () => clearTimeout(timer);
  }, [animate]);

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

  // An A, and nothing else. A B was drawn in the healthy green, which told
  // somebody whose site three clients cannot read that they were fine.
  const healthy = grade.startsWith('A');

  // The card took the same white ground whatever the number was, so a 51 and a
  // 98 arrived looking identically calm. The grade is the loudest fact on the
  // page and the page should look like it: lime for the one grade worth
  // celebrating, coral for the two that mean a client is being turned away
  // from something, amber in between.
  const ground = healthy
    ? 'bg-lime-tint'
    : grade.startsWith('D') || grade.startsWith('F')
      ? 'bg-coral-tint'
      : 'bg-amber-tint';

  return (
    <div className="edge mt-[18px] overflow-hidden rounded-[24px] bg-white">
      <div className={cx('flex flex-wrap items-center gap-8 border-b-2 border-ink px-6 py-[30px] sm:px-8', ground)}>
        {/* The face and the number, together. A grade is a letter somebody has
            to convert into a feeling; nobody has to convert a frown. */}
        <div className="flex items-center gap-4">
          <GradeBot grade={grade} size={72} className="hidden sm:block" />
          <div className="flex items-baseline gap-3">
            <span className="display-tight text-[64px] leading-none tracking-[-0.04em] tabular-nums" aria-live="off">
              {Math.round(fill)}
            </span>
            <span className="font-mono text-[14px] text-subtle-2">/ 100</span>
            <span className="sr-only">{total} out of 100</span>
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-[10px]">
            <SoftChip tone={healthy ? 'ok' : 'bad'} className="font-body text-[12.5px] font-semibold">
              Grade {grade}
            </SoftChip>
            <span className="font-mono text-[12.5px] text-subtle-2">scoring v{scoringVersion}</span>
            {profileNote ? (
              <span
                className="edge rounded-[99px] bg-canvas px-[9px] py-[2px] font-mono text-[11px] text-ink"
                title="Some checks are not asked of every kind of site."
              >
                {profileNote}
              </span>
            ) : null}
          </div>
          <p className="mt-[10px] max-w-[46ch] text-[15.5px] leading-[1.5] text-muted">{summary}</p>
          {verdict && showVerdict ? (
            <p className="anim-rise-fast mt-[10px] inline-block rounded-[9px] border-2 border-ink bg-coral-tint px-[11px] py-[6px] font-mono text-[12.5px] leading-[1.45] text-ink">
              {verdict}
            </p>
          ) : null}
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
