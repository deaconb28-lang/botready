/**
 * The pieces that appear on more than one screen.
 *
 * Two rules from tokens.css show up in every component below:
 *   every number, URL, header and user agent is set in --font-data
 *   colour is an HTTP status class and nothing else
 *
 * The visual device that ties the screens together is the wire: request and
 * response lines as they went over HTTP, typeset rather than dumped. The grade
 * band, the who-gets-in block, the landing hero and the live log are all made
 * of it, so a reader learns the material once.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

import { statusClass, type CheckStatus, type Grade } from '@botready/core';

// ------------------------------------------------------------------ shell

/** The page measure. Everything reads inside this except the ink bands. */
export function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-paper">{children}</div>;
}

export function Measure({
  children,
  className = '',
  as: As = 'div',
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'main' | 'header' | 'footer';
  wide?: boolean;
}) {
  return (
    <As className={`mx-auto w-full px-5 sm:px-8 ${wide ? 'max-w-[1180px]' : 'max-w-[1040px]'} ${className}`}>
      {children}
    </As>
  );
}

export function Nav({ action }: { action?: ReactNode }) {
  return (
    <Measure as="header" wide className="flex items-center justify-between gap-4 py-5">
      <Link href="/" className="mono text-[14px] font-bold tracking-[-0.02em]">
        botready<span className="text-fail">.dev</span>
      </Link>
      <nav aria-label="Site" className="hidden items-center gap-6 text-[13.5px] text-ink-60 sm:flex">
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
      </nav>
      {action}
    </Measure>
  );
}

/**
 * The footer is the product's own robots.txt, because that is the most honest
 * thing a crawler can put at the bottom of its own page.
 */
export function Footer() {
  return (
    <Measure as="footer" wide className="mt-20 border-t border-ink pb-12 pt-8">
      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="label text-ink-60">How to block us</p>
          <pre className="wire-line mt-2 text-ink">{`User-agent: BotreadyBot\nDisallow: /`}</pre>
          <p className="mt-3 max-w-[56ch] text-[13.5px] text-ink-60">
            We identify as BotreadyBot/1.0, obey your robots.txt, and read at most 6 pages a scan,
            one second apart. A site that refuses us is recorded as refused and shown that way.{' '}
            <Link href="/bot" className="underline">
              Everything we request
            </Link>
            .
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-6 mono text-[12.5px] text-ink-60 md:flex-col md:gap-2 md:text-right">
          <Link href="/what-we-check" className="hover:text-ink">
            Weights
          </Link>
          <Link href="/index/saas" className="hover:text-ink">
            Index
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/bot" className="hover:text-ink">
            Our crawler
          </Link>
        </nav>
      </div>
    </Measure>
  );
}

// ------------------------------------------------------------------ buttons

type ButtonTone = 'solid' | 'ghost' | 'paper';

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
  const base = 'inline-block rounded-[4px] border font-body font-semibold whitespace-nowrap';
  const scale = size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-[18px] py-2.5 text-[14px]';
  const paint = {
    solid: 'border-ink bg-ink text-paper hover:bg-[#22252b]',
    ghost: 'border-ink bg-transparent text-ink hover:bg-card',
    // On the ink band.
    paper: 'border-paper bg-paper text-ink hover:bg-card',
  }[tone];
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
    <span className={`mono rounded-[3px] border px-[9px] py-[3px] text-[11.5px] font-bold ${paint}`}>
      {label ?? (status === 0 ? 'no reply' : status)}
    </span>
  );
}

/** The status colour on the ink surface, where the light-surface reds do not read. */
export function statusOnInk(status: number): string {
  const cls = statusClass(status);
  if (cls === '2xx') return 'text-paper';
  if (cls === '3xx') return 'text-[#D69A5C]';
  return 'text-fail-dark';
}

export function statusOnPaper(status: number): string {
  const cls = statusClass(status);
  if (cls === '2xx') return 'text-pass';
  if (cls === '3xx') return 'text-warn';
  if (cls === '5xx') return 'text-server';
  if (cls === 'none') return 'text-ink-60';
  return 'text-fail';
}

export const REASON: Record<number, string> = {
  200: 'OK',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

/** `HTTP/1.1 403 Forbidden`, with the code in its class colour. */
export function StatusLine({ status, onInk = false }: { status: number; onInk?: boolean }) {
  const colour = onInk ? statusOnInk(status) : statusOnPaper(status);
  if (status === 0) {
    return (
      <span className={`mono ${colour}`}>
        <span className={onInk ? 'text-ink-key' : 'text-ink-60'}>—</span> no response
      </span>
    );
  }
  return (
    <span className="mono">
      <span className={onInk ? 'text-ink-key' : 'text-ink-60'}>HTTP/1.1 </span>
      <span className={`font-bold ${colour}`}>{status}</span>
      <span className={colour}> {REASON[status] ?? ''}</span>
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
 * or did not happen, so the meter counts too. Fills once on load; still under
 * reduced motion.
 */
export function Meter({
  value,
  segments = 20,
  tone,
  onInk = false,
  label,
  animate = false,
  height,
}: {
  value: number;
  segments?: number;
  tone?: 'pass' | 'warn' | 'fail';
  onInk?: boolean;
  label: string;
  animate?: boolean;
  height?: number;
}) {
  const filled = Math.round((clamp(value) / 100) * segments);
  const paint = onInk ? 'var(--color-fail-dark)' : `var(--color-${tone ?? scoreTone(value)})`;
  const empty = onInk ? 'var(--color-ink-seg)' : 'var(--color-rule)';
  const h = height ?? (segments > 12 ? 14 : 8);
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${label}: ${Math.round(value)} out of 100`}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="relative block flex-1 overflow-hidden rounded-[1px]"
          style={{ height: h, background: empty }}
        >
          {i < filled ? (
            <span
              className={`absolute inset-0 block ${animate ? 'br-fill' : ''}`}
              style={{ background: paint, ['--i' as string]: i }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// ------------------------------------------------------------------ text

export function Eyebrow({ children, tone = 'fail' }: { children: ReactNode; tone?: 'fail' | 'muted' }) {
  return (
    <p className={`label ${tone === 'fail' ? 'text-fail' : 'text-ink-60'}`}>{children}</p>
  );
}

export function SectionHeading({
  children,
  kicker,
  id,
}: {
  children: ReactNode;
  kicker?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-8 border-t border-ink pt-4">
      {kicker ? <p className="label text-ink-60">{kicker}</p> : null}
      <h2 className="display-section mt-1.5 text-[24px] sm:text-[28px]">{children}</h2>
    </div>
  );
}

export function Microcopy({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mono text-[12.5px] text-ink-60 ${className}`}>{children}</p>;
}

/**
 * A raw request or response, printed as it happened.
 *
 * tabIndex and the group role are not decoration: a block wide enough to scroll
 * sideways is unreachable by keyboard without them, and these blocks are the
 * part of the page a reader is most likely to want to select and forward.
 */
export function EvidenceBlock({ children, label = 'Raw evidence' }: { children: ReactNode; label?: string }) {
  return (
    <pre
      tabIndex={0}
      role="group"
      aria-label={label}
      className="wire-line mt-3 overflow-x-auto border-l-2 border-rule py-0.5 pl-4 text-ink-60"
    >
      {children}
    </pre>
  );
}

export function GradeLetter({
  grade,
  className = '',
}: {
  grade: Grade;
  className?: string;
}) {
  // A, B pass; C warns; D, F fail. Same three bands as every other colour here.
  const tone =
    grade === 'A' || grade === 'B' ? 'text-paper' : grade === 'C' ? 'text-[#D69A5C]' : 'text-fail-dark';
  return <span className={`display-grade block ${tone} ${className}`}>{grade}</span>;
}
