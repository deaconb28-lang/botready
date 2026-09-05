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
   * Icons to try, best first, each one a URL on the scanned site's own origin
   * (or wherever that site chose to host its icon). The browser walks the list
   * and stops at the first that decodes.
   *
   * The declared icon leads when the scan recorded one. The rest are the paths
   * the convention says to try, and they are guesses: betterpomo.com serves its
   * icon at /Icon_light.png and answers /favicon.ico with a 404 page, which is
   * exactly the case a single guess gets wrong.
   */
  iconCandidates: string[];
  /** True when the scan itself recorded an icon the page declared. */
  declaredIcon: boolean;
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
    iconCandidates: iconCandidates(declared, origin),
    declaredIcon: declared !== '',
    monogram: (domain.replace(/^www\./, '')[0] ?? '?').toUpperCase(),
    framing: framing(target),
  };
}

function framing(target: TargetPage): SiteIdentity['framing'] {
  // A scan taken before the scanner recorded these carries neither key. An
  // empty string means the scan looked and the server sent nothing.
  if (!('x_frame_options' in target) && !('csp' in target)) return 'unknown';
  return readFraming(str(target.x_frame_options), str(target.csp));
}

/**
 * The two headers that decide it, read the way a browser reads them.
 *
 * `frame-ancestors` wins over `X-Frame-Options` wherever both are present,
 * which is the rule in the CSP spec and the behaviour in every current
 * browser. Anything that names hosts rather than `*` refuses us, because we
 * are not one of those hosts.
 */
export function readFraming(xFrameOptions: string, contentSecurityPolicy: string): 'allowed' | 'refused' {
  const csp = contentSecurityPolicy.toLowerCase();
  const ancestors = /(?:^|;)\s*frame-ancestors\s+([^;]*)/.exec(csp)?.[1]?.trim();
  if (ancestors !== undefined) {
    return ancestors === '*' || ancestors.startsWith('* ') ? 'allowed' : 'refused';
  }

  const xfo = xFrameOptions.toLowerCase().trim();
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from')) return 'refused';
  return 'allowed';
}

/**
 * What the scan recorded, filled in by a live look at the site.
 *
 * Evidence wins wherever it exists: a scan that recorded the headers measured
 * them at scan time on the URL it actually requested, and that is a better
 * fact than one gathered later. The probe only fills gaps.
 */
export function withProbe(identity: SiteIdentity, probe: { icon: string; framing: SiteIdentity['framing'] }): SiteIdentity {
  return {
    ...identity,
    framing: identity.framing === 'unknown' ? probe.framing : identity.framing,
    iconCandidates: [...new Set([probe.icon, ...identity.iconCandidates].filter(Boolean))],
  };
}

/**
 * The declared icon, then the conventional paths, with no duplicates. A site
 * that declares /favicon.ico gets one entry, not two.
 */
function iconCandidates(declared: string, origin: string | null): string[] {
  const guesses = origin
    ? [
        `${origin}/favicon.ico`,
        `${origin}/apple-touch-icon.png`,
        `${origin}/favicon.png`,
        `${origin}/icon.png`,
        `${origin}/favicon.svg`,
      ]
    : [];
  return [...new Set([declared, ...guesses].filter(Boolean))];
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
