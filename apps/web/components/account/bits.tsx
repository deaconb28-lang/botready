import type { ReactNode } from 'react';

import { cx } from '@/components/ui';

/**
 * The small pieces the three account pages share. Every value is read off the
 * account design: the 38px page title, the 24px section title, the bordered
 * list card with its 2px lavender row rules, and the 11.5px status chip.
 */

export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[38px] font-bold leading-[1.05] tracking-[-0.035em]">{children}</h1>;
}

export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[16px] leading-[1.55] text-body', className)}>{children}</p>;
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-[14px] mt-10 font-display text-[24px] font-bold leading-[1.1] tracking-[-0.03em]">{children}</h2>;
}

/** The white list card: rows separated by the 2px lavender rule. */
export function ListCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('edge overflow-hidden rounded-[16px] bg-white shadow-hard-4', className)}>{children}</div>;
}

export function ListRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex items-center gap-[14px] border-b-2 border-rule', className)}>{children}</div>;
}

/** The status chip on a domain card: lime for a 2xx, coral for anything else. */
export function StatusPill({ ok, children, className = '' }: { ok: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'edge inline-flex flex-none items-center whitespace-nowrap rounded-[7px] px-[9px] py-[2px] font-mono text-[11.5px] font-bold text-ink',
        ok ? 'bg-lime' : 'bg-coral',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The 10px alert dot: coral when the alert is bad, lime when it is not. */
export function AlertDot({ bad }: { bad: boolean }) {
  return <span aria-hidden="true" className={cx('edge inline-block h-[10px] w-[10px] flex-none rounded-full', bad ? 'bg-coral' : 'bg-lime')} />;
}

const SMALL_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two", "three", or the digits past ten. */
export function inWords(n: number): string {
  return SMALL_NUMBERS[n] ?? String(n);
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The plan's name as it reads in a sentence. */
export function planLabel(plan: 'free' | 'monitor'): string {
  return plan === 'monitor' ? 'monitoring' : 'free';
}
