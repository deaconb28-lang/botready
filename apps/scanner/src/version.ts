/**
 * Every scan row records the version of the worker that produced it. When a
 * check breaks silently — a selector rots, a header name changes — this is how
 * you find out which scans to distrust. Bump it when the observations change
 * shape or meaning, not when a comment changes.
 */
export const SCANNER_VERSION = '1.2.0';

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

/**
 * Per-request ceiling on a plain fetch.
 *
 * Thirty seconds, not fifteen. At fifteen, npr.org failed every attempt hours
 * apart with "No response within 14986 ms" on both apex and www — and NPR was
 * not down. A ceiling low enough to time out a large, slow, working origin
 * turns "slow" into "unreachable", and the person reading the result concludes
 * their site is broken when what we measured was our own patience.
 *
 * Slow is a finding. Time to first byte is already a scored check, so an
 * origin that takes twenty seconds is reported as an origin that takes twenty
 * seconds, which is the truth and is worth knowing. Timing it out reports
 * nothing at all.
 */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * The ceiling on the five parity probes, which is deliberately shorter.
 *
 * Pass A asks five clients for the same URL and compares the answers, so
 * latency is part of the measurement rather than an obstacle to it — and five
 * probes a second apart at thirty seconds each is two and a half minutes of
 * worst case on one check. Twelve seconds is long enough that a working origin
 * answers and short enough that five of them cannot run away with the scan.
 *
 * A probe that times out is recorded as a probe that timed out. It is not
 * retried at the longer ceiling, because "this client waited twelve seconds
 * and the control did not" is exactly the kind of divergence Pass A exists to
 * find.
 */
export const CLIENT_PROBE_TIMEOUT_MS = 12_000;

/** Per-request ceiling on the headless render, which is allowed to be slower. */
export const RENDER_TIMEOUT_MS = 30_000;

/** Stop reading a response body past this. Nothing useful is beyond it. */
export const MAX_BODY_BYTES = 3_000_000;
