/**
 * The design system's meanings, as data the components read.
 *
 * Colour is semantic. Lime is pass and the active nav, coral is fail and the
 * failing grade, amber is warn, violet is the brand and the feature panel,
 * green is the healthy grade. Each category has a colour and a tint of its
 * own. Nothing here is decorative.
 */

import type { CategoryKey } from '@botready/core';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface CategoryPaint {
  key: CategoryKey;
  color: string;
  tint: string;
  /** What the category measures, in one line. */
  what: string;
}

export const CATEGORY_PAINT: Record<CategoryKey, CategoryPaint> = {
  retrievability: {
    key: 'retrievability',
    color: '#FF6B5A',
    tint: '#FFF1EF',
    what: 'Can each client get the page at all, and is the text there without JavaScript',
  },
  discovery: {
    key: 'discovery',
    color: '#C6F53C',
    tint: '#F6FDE6',
    what: 'robots.txt, sitemap.xml, llms.txt and the paths agents look for',
  },
  representation: {
    key: 'representation',
    color: '#4B44F5',
    tint: '#EFEEFE',
    what: 'Whether your own description of what you do is readable as data',
  },
  structure: {
    key: 'structure',
    color: '#FFCF5C',
    tint: '#FFF9EA',
    what: 'Headings, titles and link targets that actually resolve',
  },
  actionability: {
    key: 'actionability',
    color: '#7ED9C3',
    tint: '#EFFAF7',
    what: 'Prices, plans and next steps an agent can quote',
  },
  freshness: {
    key: 'freshness',
    color: '#F2A0D8',
    tint: '#FDF0F9',
    what: 'Dates and change signals on the pages that carry them',
  },
};

/** The short display name for each client the scanner requests as. */
export const CLIENT_NAMES: Record<string, string> = {
  chrome: 'Chrome 128',
  claudebot: 'ClaudeBot/1.0',
  gptbot: 'GPTBot/1.2',
  perplexity: 'PerplexityBot',
  googleext: 'Google-Extended',
};

/** The short id the design prints in tables: `google-ext`, not `googleext`. */
export const CLIENT_IDS: Record<string, string> = {
  chrome: 'chrome',
  claudebot: 'claudebot',
  gptbot: 'gptbot',
  perplexity: 'perplexity',
  googleext: 'google-ext',
};

/** A status code's tone. A transport failure is recorded as 0 and is bad. */
export function toneForStatus(status: number): Tone {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'warn';
  return 'bad';
}

/** A category's bar colour: under 50 coral, under 75 ink, otherwise green. */
export function barColorFor(pct: number): string {
  if (pct < 50) return '#FF6B5A';
  if (pct < 75) return '#111318';
  return '#3F8F1E';
}

/** A score's text colour in a table: 80 and up green, 65 and up ink, else coral. */
export function scoreColorFor(total: number): string {
  if (total >= 80) return '#2E9B5E';
  if (total >= 65) return '#111318';
  return '#B23C1F';
}

/** A grade tile is coral for D and F, and for C; green for A and B. */
export function gradeIsHealthy(grade: string): boolean {
  return grade.startsWith('A') || grade.startsWith('B');
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}

/** "2d ago", "5h ago", "just now". */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
