/**
 * Facts about the product that appear in more than one place. Copy lives in the
 * components; this is only the things that must not drift, like the user agent
 * string the /bot page has to match and the price the paywall has to match.
 */

export const SITE = {
  name: 'botready.dev',
  /** Used for absolute URLs in OG tags and share cards. */
  origin: process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://botready.dev',
  tagline: 'Measure how legible your site is to AI agents.',
} as const;

/**
 * Must match apps/scanner/src/version.ts. The /bot page prints this verbatim,
 * and a test asserts the two agree, because a user agent that does not match
 * the page it points at is a broken promise rather than a typo.
 */
export const USER_AGENT = 'BotreadyBot/1.0 (+https://botready.dev/bot)';
export const ROBOTS_TOKEN = 'BotreadyBot';

export const LIMITS = {
  maxPagesPerScan: 6,
  pageDelayMs: 1000,
  anonymousScansPerHour: 5,
  signedInScansPerHour: 50,
  cacheHours: 24,
} as const;

export const PRICING = {
  fixpack: { amount: 99, currency: 'usd', label: '$99', cadence: 'one time' },
  monitor: { amount: 29, currency: 'usd', label: '$29', cadence: 'per month' },
} as const;

export const SEGMENTS = [
  { key: 'saas', label: 'SaaS' },
  { key: 'devtools', label: 'Dev tools' },
  { key: 'ecommerce', label: 'Ecommerce' },
  { key: 'media', label: 'Media' },
] as const;

export type SegmentKey = (typeof SEGMENTS)[number]['key'];

export function isSegment(value: string): value is SegmentKey {
  return SEGMENTS.some((s) => s.key === value);
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.origin).toString();
}
