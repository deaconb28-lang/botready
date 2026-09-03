/**
 * Domain and URL normalisation. Pure, so the cache key the web app computes and
 * the cache key the worker computes are the same string. If these ever diverge
 * the 24 hour dedupe cache silently stops working, so it lives in one place.
 */

/**
 * lowercase, no scheme, no www, no trailing slash, no port, no path.
 * Matches the comment on `sites.domain` in db/schema.sql.
 */
export function normaliseDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.replace(/^[^/?#]*@/, ''); // userinfo, if someone pasted credentials
  s = s.split(/[/?#]/)[0] ?? '';
  s = s.replace(/:\d+$/, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\.$/, ''); // the root-label dot form of a FQDN
  return s;
}

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Turn what a person typed into a URL we are willing to consider fetching.
 * This is the shape check only. Whether the host is safe to connect to is a
 * separate decision made in the worker, after DNS, in apps/scanner/src/guard.ts.
 */
export function normaliseTargetUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new InvalidUrlError('Enter a URL.');

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidUrlError(`${raw} is not a URL we can parse.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError(
      `We fetch over http and https. ${url.protocol.replace(':', '')} is not something we will request.`,
    );
  }
  if (!url.hostname.includes('.')) {
    throw new InvalidUrlError(
      `${url.hostname} has no dot in it, so it is not a public hostname. Enter a domain like example.com.`,
    );
  }
  if (url.username || url.password) {
    throw new InvalidUrlError('Remove the credentials from the URL. We do not scan behind auth.');
  }

  url.hash = '';
  return url.toString();
}

/** `https://example.com/pricing` -> `https://example.com`. */
export function originOf(url: string): string {
  return new URL(url).origin;
}

/** Resolve a path against the target's origin: `/robots.txt` -> full URL. */
export function atOrigin(url: string, path: string): string {
  return new URL(path, originOf(url) + '/').toString();
}

/** Compare two URLs ignoring the trailing slash and the fragment. */
export function sameUrl(a: string, b: string): boolean {
  const strip = (s: string) => {
    try {
      const u = new URL(s);
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return s.replace(/\/$/, '');
    }
  };
  return strip(a) === strip(b);
}

/** The HTTP status class, which is what every colour in this product means. */
export function statusClass(status: number): '2xx' | '3xx' | '4xx' | '5xx' | 'none' {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'none';
}
