/**
 * Facts about the product that appear in more than one place. Copy lives in the
 * components; this is only the things that must not drift, like the user agent
 * string the /bot page has to match and the price the paywall has to match.
 */

export const SITE = {
  name: 'botready.dev',
  /** Used for absolute URLs in OG tags and share cards. */
  origin: process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://botready.dev',
  tagline: 'Are you BotReady?',
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

/**
 * What things cost.
 *
 * `fixpack` is the first domain. `fixpackExtra` is every domain after it, for
 * somebody who already owns one — a pack is generated per domain from that
 * domain's own pages, so a second one is real work, but almost none of it is
 * work they are paying for twice.
 *
 * The cadence strings are the words on the page, not a Stripe interval. The
 * fix pack is a one-off charge either way.
 */
/**
 * The launch-day discount.
 *
 * One flag, because the banner has to come down the moment the code stops
 * working and hunting for it in JSX is how a dead offer stays on a site for a
 * week. `code` must exist as a promotion code in Stripe on a coupon of the
 * matching size — nothing here creates it, and a banner advertising a code
 * checkout rejects is worse than no banner.
 */
export const PROMO = {
  active: true,
  code: 'LAUNCHDAY',
  off: '50% off',
} as const;

export const PRICING = {
  fixpack: { amount: 15, currency: 'usd', label: '$15', cadence: 'one time' },
  fixpackExtra: { amount: 5, currency: 'usd', label: '$5', cadence: 'per extra domain' },
  monitor: { amount: 5, currency: 'usd', label: '$5', cadence: 'per month' },
} as const;

/**
 * Stripe payment links.
 *
 * A payment link is a page Stripe hosts and we redirect to, rather than a
 * Checkout Session this code creates. It is public by design — the URL is
 * meant to be pasted into an email — so it lives here beside the prices
 * rather than in the environment, and an env var overrides it when the same
 * build is pointed at a test-mode link.
 *
 * The checkout routes reach for a Checkout Session first and only fall back to
 * these, because where a payment link sends someone after paying is a field in
 * the Stripe dashboard rather than a line in this repository. Pasting one into
 * an email is still exactly what they are for.
 *
 * What the link cannot carry, we carry ourselves: `client_reference_id` holds
 * the scan or site the purchase is for, and the webhook reads it back. That is
 * the whole reason these are not raw URLs in a template.
 */
export const PAYMENT_LINKS = {
  fixpack: process.env.STRIPE_LINK_FIXPACK ?? 'https://buy.stripe.com/fZuaEWagy9pTfzFg7D0x208',
  monitor: process.env.STRIPE_LINK_MONITOR ?? 'https://buy.stripe.com/6oU9ASewO1Xr4V12gN0x207',
} as const;

/**
 * A payment link with the purchase attached to it. Stripe echoes
 * `client_reference_id` on the completed session, which is how the webhook
 * knows which scan was bought, and prefills the email so the receipt and the
 * entitlement land on the same address.
 *
 * Refuses anything that is not one of Stripe's own hosted checkout hosts, so a
 * mistyped environment variable cannot turn a "Buy" button into an open
 * redirect.
 */
export function paymentLink(plan: keyof typeof PAYMENT_LINKS, reference: string, email?: string | null): string | null {
  let url: URL;
  try {
    url = new URL(PAYMENT_LINKS[plan]);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !['buy.stripe.com', 'checkout.stripe.com'].includes(url.hostname)) return null;
  url.searchParams.set('client_reference_id', reference);
  if (email) url.searchParams.set('prefilled_email', email);
  return url.toString();
}

/**
 * What each plan allows. The account area prints these as "2 of 3", and the
 * monitor cron and the claim flow enforce them.
 */
export const PLAN_LIMITS = {
  free: { domains: 1, scansPerMonth: 10 },
  monitor: { domains: 3, scansPerMonth: 30 },
} as const;

/**
 * The one address, everywhere. The footer, the crawler page, the docs, the
 * sign-in fallback, the JSON-LD, the agent manifests, and the From and Reply-To
 * on everything we send.
 *
 * One constant rather than a constant plus a few literals: the sender was
 * hardcoded separately once, drifted to an address that did not exist, and mail
 * from it went nowhere until someone noticed.
 */
export const CONTACT_EMAIL = 'team@botready.dev';

/** The credit line in the footer. */
export const CREDIT = { text: 'designed with love by Deacon Brantley @ itsdeacon.com', href: 'https://itsdeacon.com' };

/**
 * Whether the public index is advertised anywhere on the site.
 *
 * Off while there are too few scored sites for a ranking to be worth reading.
 * The pages themselves still work and every link ever shared still resolves —
 * what this turns off is us pointing at them: the header, the footer, the two
 * calls to action, the sitemap, llms.txt, and the pages' own indexability.
 *
 * Flip it back to true when there are enough answers to rank. That is the
 * whole change; nothing was deleted.
 */
export const PUBLIC_INDEX_LISTED = false;

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
