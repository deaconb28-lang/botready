/**
 * The primitives every surface is built from.
 *
 * Hard edges throughout: a 2px ink border on every card, chip, button, input
 * and toggle, and elevation as a hard offset shadow with no blur. Colour is
 * semantic and lives in lib/theme.ts. Nothing in here has state; the pieces
 * that do (the toggle, the typing chat, the race) are their own client files.
 */

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

import type { Tone } from '@/lib/theme';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ brand

/** The 28px violet rounded square with a lime `b` in mono. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="edge flex flex-none items-center justify-center rounded-[9px] bg-violet font-mono font-bold text-lime"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.54) }}
    >
      b
    </span>
  );
}

export function Wordmark({ size = 19, markSize = 28, href = '/' }: { size?: number; markSize?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-[9px] whitespace-nowrap text-ink no-underline hover:text-ink">
      <Mark size={markSize} />
      <span className="display" style={{ fontSize: size, letterSpacing: '-0.02em' }}>
        BotReady
      </span>
    </Link>
  );
}

// ------------------------------------------------------------------ surfaces

type Shadow = 0 | 2 | 3 | 4 | 5 | 6 | 7 | 'violet-4' | 'violet-5' | 'violet-7' | 'lime-4' | 'lime-6';

const SHADOW_CLASS: Record<string, string> = {
  '0': '',
  '2': 'shadow-hard-2',
  '3': 'shadow-hard-3',
  '4': 'shadow-hard-4',
  '5': 'shadow-hard-5',
  '6': 'shadow-hard-6',
  '7': 'shadow-hard-7',
  'violet-4': 'shadow-violet-4',
  'violet-5': 'shadow-violet-5',
  'violet-7': 'shadow-violet-7',
  'lime-4': 'shadow-lime-4',
  'lime-6': 'shadow-lime-6',
};

type Surface = 'surface' | 'alt' | 'ink' | 'violet' | 'lime' | 'coral' | 'green' | 'canvas' | 'none';

const SURFACE_CLASS: Record<Surface, string> = {
  surface: 'bg-surface text-ink',
  alt: 'bg-surface-alt text-ink',
  ink: 'bg-ink text-on-ink-light on-dark',
  violet: 'bg-violet text-white on-dark',
  lime: 'bg-lime text-ink on-lime',
  coral: 'bg-coral text-ink',
  green: 'bg-green text-white on-dark',
  canvas: 'bg-canvas text-ink',
  none: '',
};

/**
 * A bordered panel. `shadow` is the hard offset in px, `lift` makes it rise
 * on hover with the shadow growing 2px, `radius` is the design's three sizes.
 */
export function Card({
  children,
  surface = 'surface',
  shadow = 4,
  radius = 'card',
  lift = false,
  edge = true,
  className = '',
  style,
  as: As = 'div',
  id,
}: {
  children: ReactNode;
  surface?: Surface;
  shadow?: Shadow;
  radius?: 'chip' | 'card' | 'card-lg' | 'panel' | 'panel-lg' | 'xl' | 'none';
  lift?: boolean;
  edge?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li' | 'nav';
  id?: string;
}) {
  const radiusClass = {
    chip: 'rounded-[9px]',
    card: 'rounded-[14px]',
    'card-lg': 'rounded-[16px]',
    panel: 'rounded-[18px]',
    'panel-lg': 'rounded-[20px]',
    xl: 'rounded-[24px]',
    none: '',
  }[radius];
  return (
    <As
      id={id}
      style={style}
      className={cx(
        edge && 'edge',
        SURFACE_CLASS[surface],
        radiusClass,
        SHADOW_CLASS[String(shadow)],
        lift && 'lift',
        className,
      )}
    >
      {children}
    </As>
  );
}

// ------------------------------------------------------------------ text roles

/** The uppercase mono label. */
export function Eyebrow({
  children,
  tone = 'subtle',
  className = '',
  as: As = 'span',
}: {
  children: ReactNode;
  tone?: 'subtle' | 'lime' | 'violet' | 'ink' | 'body' | 'on-ink';
  className?: string;
  as?: 'span' | 'p' | 'div';
}) {
  const color = {
    subtle: 'text-subtle-2',
    lime: 'text-lime',
    violet: 'text-violet',
    ink: 'text-ink',
    body: 'text-body',
    'on-ink': 'text-on-ink-label',
  }[tone];
  return <As className={cx('eyebrow block', color, className)}>{children}</As>;
}

/** The lime pill eyebrow used on dark panels: "THE CHECK [04]". */
export function PillEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'edge inline-block rounded-full bg-lime px-3 py-1 font-mono text-[11px] font-bold tracking-[0.12em] text-ink uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ chips

const TONE_BG: Record<Tone, string> = {
  ok: 'bg-lime text-ink',
  warn: 'bg-amber text-ink',
  bad: 'bg-coral text-ink',
  neutral: 'bg-canvas text-subtle-2',
};

/** A bordered mono chip: a status code, a count, a file name. */
export function Chip({
  children,
  tone = 'neutral',
  className = '',
  size = 'md',
  title,
}: {
  children: ReactNode;
  tone?: Tone | 'surface' | 'violet' | 'ink';
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
}) {
  const paint =
    tone === 'surface'
      ? 'bg-surface text-ink'
      : tone === 'violet'
        ? 'bg-violet text-white'
        : tone === 'ink'
          ? 'bg-ink text-lime'
          : TONE_BG[tone];
  const scale = size === 'sm' ? 'px-2 py-px text-[11.5px]' : 'px-[9px] py-[2px] text-[12px]';
  return (
    <span title={title} className={cx('edge inline-flex flex-none items-center whitespace-nowrap rounded-[7px] font-mono font-bold', paint, scale, className)}>
      {children}
    </span>
  );
}

/** The soft tinted chip without a border: the result page's status column and the grade chip. */
export function SoftChip({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone: 'ok' | 'bad' | 'violet' | 'neutral';
  className?: string;
}) {
  const paint = {
    ok: 'bg-green-tint text-green-text',
    bad: 'bg-coral-tint text-coral-text',
    violet: 'bg-violet-chip text-violet',
    neutral: 'bg-hairline-2 text-subtle-2',
  }[tone];
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-[7px] px-[9px] py-1 font-mono text-[12px] font-medium', paint, className)}>
      {children}
    </span>
  );
}

/** A status code as a chip, coloured by its class. */
export function StatusChip({ status, className = '', size = 'md' }: { status: number; className?: string; size?: 'sm' | 'md' }) {
  const tone: Tone = status >= 200 && status < 300 ? 'ok' : status >= 300 && status < 400 ? 'warn' : 'bad';
  return (
    <Chip tone={tone} size={size} className={className} title={status === 0 ? 'No response' : undefined}>
      {status === 0 ? 'ERR' : status}
    </Chip>
  );
}

// ------------------------------------------------------------------ buttons

type ButtonTone = 'ink' | 'lime' | 'white' | 'outline' | 'outline-white' | 'violet' | 'text';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_TONE: Record<ButtonTone, string> = {
  ink: 'edge bg-ink text-white hover:bg-violet hover:text-white',
  lime: 'edge bg-lime text-ink hover:bg-white on-lime',
  white: 'edge bg-white text-ink hover:bg-lime',
  outline: 'edge bg-transparent text-ink hover:bg-ink hover:text-white',
  'outline-white': 'border-2 border-white bg-transparent text-white hover:bg-white hover:text-violet',
  violet: 'edge bg-violet text-white hover:bg-ink hover:text-white',
  text: 'border-0 bg-transparent text-muted underline underline-offset-[3px] hover:text-ink',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'rounded-[9px] px-[14px] py-[8px] text-[13.5px]',
  md: 'rounded-[10px] px-4 py-[10px] text-[14px]',
  lg: 'rounded-[12px] px-[22px] py-[14px] text-[15px]',
};

export function buttonClass({
  tone = 'ink',
  size = 'md',
  shadow = 0,
  weight = 600,
  className = '',
}: {
  tone?: ButtonTone;
  size?: ButtonSize;
  shadow?: Shadow;
  weight?: 500 | 600 | 700;
  className?: string;
} = {}): string {
  const w = weight === 700 ? 'font-bold' : weight === 500 ? 'font-medium' : 'font-semibold';
  return cx(
    'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-body no-underline transition-colors duration-150 disabled:cursor-progress disabled:opacity-70',
    BUTTON_TONE[tone],
    tone === 'text' ? 'p-0 text-[13.5px] font-medium' : BUTTON_SIZE[size],
    SHADOW_CLASS[String(shadow)],
    w,
    className,
  );
}

/**
 * A button, or a link that looks like one. Every interactive element is a
 * real <button> or <a>; nothing is a div with a click handler.
 */
export function Button({
  children,
  href,
  onClick,
  type = 'button',
  disabled,
  tone,
  size,
  shadow,
  weight,
  className,
  ariaLabel,
  prefetch,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  tone?: ButtonTone;
  size?: ButtonSize;
  shadow?: Shadow;
  weight?: 500 | 600 | 700;
  className?: string;
  ariaLabel?: string;
  prefetch?: boolean;
}) {
  const cls = buttonClass({ tone, size, shadow, weight, className });
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel} prefetch={prefetch}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ terminal

/** A blinking block cursor. Decorative. */
export function Cursor({ color = 'bg-lime', height = 12, className = '' }: { color?: string; height?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('anim-cursor inline-block w-[7px] align-[-1px]', color, className)}
      style={{ height }}
    />
  );
}

/** The one-line terminal: `$ claude "apply botready-fixes.md"` with a cursor. */
export function TerminalLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'edge overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] bg-ink px-[13px] py-[11px] font-mono text-[12px] text-lime',
        className,
      )}
    >
      {children} <Cursor />
    </div>
  );
}

/** A dark terminal card with a title bar: the ClaudeBot response, the raw detail. */
export function TerminalCard({
  title,
  children,
  footer,
  dot = 'bg-coral',
  className = '',
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dot?: string;
  className?: string;
}) {
  return (
    <div className={cx('on-dark overflow-hidden rounded-[20px] border border-ink bg-ink text-on-ink-2', className)}>
      <div className="flex items-center gap-[9px] border-b border-ink-4 bg-ink-3 px-[14px] py-[11px]">
        <span className={cx('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
        <span className="font-mono text-[11.5px] font-medium tracking-[0.08em] text-subtle-2 uppercase">{title}</span>
      </div>
      {children}
      {footer ? <div className="flex items-center justify-between gap-[10px] border-t border-ink-4 bg-ink-3 px-[18px] py-3">{footer}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ connectors and bars

/** The animated dashed request connector between a node and its rows. */
export function DashConnector({ color = '#C6F53C', width = 28, className = '' }: { color?: string; width?: number; className?: string }) {
  return <div aria-hidden="true" className={cx('dash-line flex-none', className)} style={{ width, ['--dash-color' as string]: color }} />;
}

/** A bordered 10px progress track with a coloured fill. */
export function Bar({
  pct,
  color,
  track = 'bg-canvas',
  height = 10,
  className = '',
  label,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={cx('edge overflow-hidden rounded-full', track, className)}
      style={{ height }}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(clamped) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div className="bar-fill h-full" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

/** The thin 5px unbordered bar the results page uses under each category. */
export function ThinBar({ pct, color, className = '' }: { pct: number; color: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cx('h-[5px] overflow-hidden rounded-full bg-hairline', className)} aria-hidden="true">
      <div className="bar-fill h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

// ------------------------------------------------------------------ grades

/** The 88px grade tile: coral for a failing grade, green for a healthy one. */
export function GradeTile({
  grade,
  caption,
  healthy,
  size = 88,
  className = '',
}: {
  grade: string;
  caption?: string;
  healthy: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'edge flex flex-none flex-col items-center justify-center rounded-[16px]',
        healthy ? 'bg-green text-white' : 'bg-coral text-ink',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="display leading-none" style={{ fontSize: Math.round(size * 0.386) }}>
        {grade}
      </span>
      {caption ? <span className="mt-[2px] font-mono text-[11px] font-medium">{caption}</span> : null}
    </div>
  );
}

/** The small grade chip beside a domain: "C−" on coral or "B+" on green. */
export function GradeChip({ grade, healthy, className = '' }: { grade: string; healthy: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'edge inline-flex flex-none items-center rounded-[7px] px-2 py-px font-mono text-[12.5px] font-bold',
        healthy ? 'bg-green text-white' : 'bg-coral text-ink',
        className,
      )}
    >
      {grade}
    </span>
  );
}

// ------------------------------------------------------------------ layout

/** The page measure. */
export function Container({
  children,
  width = 1200,
  className = '',
  as: As = 'div',
  id,
}: {
  children: ReactNode;
  width?: number;
  className?: string;
  as?: 'div' | 'section' | 'main' | 'header' | 'footer';
  id?: string;
}) {
  return (
    <As id={id} className={cx('mx-auto w-full px-6 sm:px-[26px]', className)} style={{ maxWidth: width }}>
      {children}
    </As>
  );
}

/** A page title with an eyebrow above it. */
export function PageTitle({
  eyebrow,
  children,
  lede,
  center = false,
  size = 'lg',
  className = '',
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  lede?: ReactNode;
  center?: boolean;
  size?: 'lg' | 'xl' | 'md';
  className?: string;
}) {
  const scale = {
    md: 'text-[36px] sm:text-[38px]',
    lg: 'text-[clamp(38px,5.2vw,64px)]',
    xl: 'text-[clamp(40px,5.6vw,68px)] leading-none',
  }[size];
  return (
    <div className={cx(center && 'text-center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className={cx('display-tight mt-3', scale)}>{children}</h1>
      {lede ? <p className={cx('mt-4 text-[17px] leading-[1.6] text-muted', center ? 'mx-auto max-w-[54ch]' : 'max-w-[58ch]')}>{lede}</p> : null}
    </div>
  );
}

/** A row separated by the 2px lavender rule inside a bordered card. */
export function Row({ children, className = '', last = false }: { children: ReactNode; className?: string; last?: boolean }) {
  return <div className={cx('flex items-center gap-[14px] px-5 py-4', !last && 'border-b-2 border-rule', className)}>{children}</div>;
}

/** The severity dot beside a finding: coral for fail, amber for warn. */
export function SeverityDot({ severity, size = 12 }: { severity: 'fail' | 'warn' | 'error' | 'pass'; size?: number }) {
  const bg = severity === 'fail' ? 'bg-coral' : severity === 'warn' ? 'bg-amber' : severity === 'error' ? 'bg-violet' : 'bg-lime';
  return <span aria-hidden="true" className={cx('edge inline-block flex-none rounded-full', bg)} style={{ width: size, height: size }} />;
}
