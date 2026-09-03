/**
 * The pieces that appear on more than one screen. Everything here is a direct
 * translation of docs/botready-ui-mockups.html, which is the reference rather
 * than an inspiration board.
 *
 * Two rules from tokens.css show up in every component below:
 *   every number, URL, header and user agent is set in --font-data
 *   colour is an HTTP status class and nothing else
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

import { statusClass, type CheckStatus, type Grade } from '@botready/core';

// ------------------------------------------------------------------ chrome

export function Nav({ action }: { action?: ReactNode }) {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4 sm:px-7">
      <Link href="/" className="font-data text-[14px] font-bold tracking-[-0.02em]">
        botready<span className="text-fail">.dev</span>
      </Link>
      <div className="hidden gap-[22px] text-[13px] text-ink-60 sm:flex">
        <Link href="/index/saas" className="hover:text-ink">
          Index
        </Link>
        <Link href="/what-we-check" className="hover:text-ink">
          What we check
        </Link>
        <Link href="/pricing" className="hover:text-ink">
          Pricing
        </Link>
        <Link href="/bot" className="hover:text-ink">
          Our crawler
        </Link>
      </div>
      {action}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-rule px-5 py-8 sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-[52ch] font-data text-micro text-ink-60">
          We identify as BotreadyBot/1.0, obey your robots.txt, and read at most 6 pages a
          scan, one second apart. If a site refuses us we record it as refused and show it
          that way. <Link href="/bot" className="underline">How to block us</Link>.
        </p>
        <div className="flex gap-5 font-data text-micro text-ink-60">
          <Link href="/what-we-check" className="hover:text-ink">
            Weights
          </Link>
          <Link href="/index/saas" className="hover:text-ink">
            Index
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ------------------------------------------------------------------ buttons

type ButtonTone = 'solid' | 'ghost';

export function ButtonLink({
  href,
  children,
  tone = 'solid',
  size = 'md',
  className = '',
}: {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(tone, size, className)}>
      {children}
    </Link>
  );
}

export function buttonClass(tone: ButtonTone = 'solid', size: 'sm' | 'md' = 'md', extra = '') {
  const base =
    'inline-block rounded-[4px] border border-ink font-body font-semibold whitespace-nowrap';
  const scale = size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-[18px] py-2.5 text-[14px]';
  const paint =
    tone === 'solid'
      ? 'bg-ink text-paper hover:bg-[#22252b]'
      : 'bg-transparent text-ink hover:bg-card';
  return `${base} ${scale} ${paint} ${extra}`;
}

// ------------------------------------------------------------------ status

/**
 * A status code in its own colour. Green is 2xx, amber is 3xx, red is 4xx,
 * plum is 5xx, and there is no fifth possibility, which is why this reads as a
 * legend a person learns once.
 */
export function StatusPill({ status, label }: { status: number; label?: string }) {
  const cls = statusClass(status);
  const paint = {
    '2xx': 'text-pass border-pass bg-pass/8',
    '3xx': 'text-warn border-warn bg-warn/9',
    '4xx': 'text-fail border-fail bg-fail/9',
    '5xx': 'text-server border-server bg-server/9',
    none: 'text-ink-60 border-rule bg-transparent',
  }[cls];
  return (
    <span
      className={`rounded-[3px] border px-[9px] py-[3px] font-data text-[11.5px] font-bold ${paint}`}
    >
      {label ?? (status === 0 ? 'no reply' : status)}
    </span>
  );
}

export function statusColorVar(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return 'var(--color-pass)';
    case 'warn':
      return 'var(--color-warn)';
    case 'fail':
      return 'var(--color-fail)';
    case 'error':
      return 'var(--color-server)';
    default:
      return 'var(--color-rule)';
  }
}

/** Category subscores take their colour from the same three bands everywhere. */
export function scoreTone(value: number): 'pass' | 'warn' | 'fail' {
  if (value >= 70) return 'pass';
  if (value >= 40) return 'warn';
  return 'fail';
}

// ------------------------------------------------------------------ meters

/**
 * Discrete segments, never a ring. A check list is a count of things that did
 * or did not happen, so the meter counts too.
 */
export function Meter({
  value,
  segments = 20,
  tone,
  onInk = false,
  label,
}: {
  value: number;
  segments?: number;
  tone?: 'pass' | 'warn' | 'fail';
  onInk?: boolean;
  label: string;
}) {
  const filled = Math.round((clamp(value) / 100) * segments);
  const paint = onInk
    ? 'var(--color-fail-dark)'
    : `var(--color-${tone ?? scoreTone(value)})`;
  return (
    <div
      className="flex gap-[3px]"
      role="img"
      aria-label={`${label}: ${Math.round(value)} out of 100`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <i
          key={i}
          aria-hidden="true"
          className="block flex-1 rounded-[1px]"
          style={{
            height: segments > 12 ? 14 : 8,
            background: i < filled ? paint : onInk ? 'var(--color-ink-seg)' : 'var(--color-rule)',
          }}
        />
      ))}
    </div>
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// ------------------------------------------------------------------ surfaces

export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <As
      className={`rounded-[6px] border border-rule bg-card px-[22px] py-5 ${className}`}
    >
      {children}
    </As>
  );
}

export function CardHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3.5 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-ink-60">
      {children}
    </h2>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-data text-[11px] uppercase tracking-[0.12em] text-fail">{children}</p>
  );
}

export function Microcopy({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-data text-[12.5px] text-ink-60 ${className}`}>{children}</p>
  );
}

/** A raw request or response, printed as it happened. */
export function EvidenceBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-[4px] border border-dashed border-rule bg-paper px-[13px] py-[11px] font-data text-[12px] whitespace-pre-wrap text-ink-60">
      {children}
    </pre>
  );
}

export function GradeLetter({
  grade,
  className = '',
  width = 122,
}: {
  grade: Grade;
  className?: string;
  width?: number;
}) {
  // A, B pass; C warns; D, F fail. Same three bands as every other colour here.
  const tone =
    grade === 'A' || grade === 'B' ? 'text-paper' : grade === 'C' ? 'text-warn' : 'text-fail-dark';
  return (
    <span
      className={`block font-display font-extrabold leading-[0.9] tracking-[-0.03em] ${tone} ${className}`}
      style={{ fontVariationSettings: `'wdth' ${width}` }}
    >
      {grade}
    </span>
  );
}
