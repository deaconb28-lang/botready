/**
 * Every scan row records the version of the worker that produced it. When a
 * check breaks silently — a selector rots, a header name changes — this is how
 * you find out which scans to distrust. Bump it when the observations change
 * shape or meaning, not when a comment changes.
 */
export const SCANNER_VERSION = '1.0.0';

/**
 * One user agent, one place. It names the product and links to a page that
 * explains how to block it, which is the whole reason it is descriptive.
 */
export const USER_AGENT = 'BotreadyBot/1.0 (+https://botready.dev/bot)';

/** The token a site's robots.txt would use to address us. */
export const ROBOTS_TOKEN = 'BotreadyBot';

/** Hard cap. A diagnostic tool, not a load generator. */
export const MAX_PAGES_PER_SCAN = 6;

/**
 * Sequential, and this far apart.
 *
 * A product constraint, not a tuning knob: we are a diagnostic tool, not a load
 * generator, and the landing page says so. SCANNER_PAGE_DELAY_MS exists only so
 * the scan tests, which run a real scan against a loopback fixture, do not take
 * half an hour. Like the guard's allowlist it is ignored outright in production,
 * and a test asserts that.
 */
export const PAGE_DELAY_MS = pageDelayMs();

function pageDelayMs(): number {
  if (process.env.NODE_ENV === 'production') return 1000;
  const override = Number(process.env.SCANNER_PAGE_DELAY_MS);
  return Number.isFinite(override) && override >= 0 ? override : 1000;
}

/** Per-request ceiling on a plain fetch. */
export const FETCH_TIMEOUT_MS = 15_000;

/** Per-request ceiling on the headless render, which is allowed to be slower. */
export const RENDER_TIMEOUT_MS = 30_000;

/** Stop reading a response body past this. Nothing useful is beyond it. */
export const MAX_BODY_BYTES = 3_000_000;
