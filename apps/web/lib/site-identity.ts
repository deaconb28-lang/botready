import type { CheckResult } from '@botready/core';

/**
 * Who the scanned site says it is.
 *
 * A result page that shows nothing but a number and a list of complaints does
 * not look like it is about anyone's site in particular. This is the small
 * amount of the site's own identity — its icon, its title, the sentence it
 * wrote about itself — that makes the page read as a report on *them*.
 *
 * Every field comes off evidence the scan already recorded. Nothing here is
 * fetched at render time on the server, and nothing is asked of a third party:
 * the icon is a URL on the scanned site's own origin, loaded by the reader's
 * browser or not at all.
 */
export interface SiteIdentity {
  domain: string;
  /** The exact URL the scan requested, which is what an embed should show. */
  url: string;
  /** The home page's own <title>, empty when it has none. */
  title: string;
  /** The home page's meta description, empty when it has none. */
  description: string;
  /**
   * The icon to try first. The page's declared icon when it has one, and
   * /favicon.ico otherwise — served by convention on most sites, and a request
   * that costs the reader nothing when it 404s.
   */
  iconUrl: string;
  /** Shown in place of the icon when the icon does not load. */
  monogram: string;
  /**
   * Whether the page can be put in a frame, read from the headers the scan
   * recorded. `unknown` for a scan taken before the scanner recorded them,
   * which is not the same as `allowed`.
   */
  framing: 'allowed' | 'refused' | 'unknown';
}

interface TargetPage {
  url?: unknown;
  title?: unknown;
  description?: unknown;
  icon?: unknown;
  x_frame_options?: unknown;
  csp?: unknown;
}

export function siteIdentity(results: CheckResult[], domain: string, url: string): SiteIdentity {
  const pages = results.find((r) => r.key === 'title_meta_distinct')?.observed.pages;
  const target: TargetPage = Array.isArray(pages) && pages.length > 0 ? (pages[0] as TargetPage) : {};

  const declared = str(target.icon);
  const origin = originOrNull(url);

  return {
    domain,
    url,
    title: str(target.title),
    description: str(target.description),
    iconUrl: declared || (origin ? `${origin}/favicon.ico` : ''),
    monogram: (domain.replace(/^www\./, '')[0] ?? '?').toUpperCase(),
    framing: framing(target),
  };
}

/**
 * The two headers that decide it, read the way a browser reads them.
 *
 * `frame-ancestors` wins over `X-Frame-Options` wherever both are present,
 * which is the rule in the CSP spec and the behaviour in every current
 * browser. Anything that names hosts rather than `*` refuses us, because we
 * are not one of those hosts.
 */
function framing(target: TargetPage): SiteIdentity['framing'] {
  // A scan taken before the scanner recorded these carries neither key. An
  // empty string means the scan looked and the server sent nothing.
  if (!('x_frame_options' in target) && !('csp' in target)) return 'unknown';

  const csp = str(target.csp).toLowerCase();
  const ancestors = /(?:^|;)\s*frame-ancestors\s+([^;]*)/.exec(csp)?.[1]?.trim();
  if (ancestors !== undefined) {
    return ancestors === '*' || ancestors.startsWith('* ') ? 'allowed' : 'refused';
  }

  const xfo = str(target.x_frame_options).toLowerCase().trim();
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from')) return 'refused';
  return 'allowed';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function originOrNull(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
