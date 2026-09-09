/**
 * Knocking on the other door.
 *
 * A great many small-business sites answer on `www` and not on the bare
 * domain, or the reverse. Squarespace is the common case: the certificate
 * covers `*.squarespace.com` and `www.example.com` but not `example.com`, so a
 * request to the apex fails TLS hostname verification before any HTTP happens.
 *
 * Observed on 2 of 50 north-Seattle businesses — salishbrewing.com and
 * hemlockstate.com — both of which recorded a scanner error, and both of which
 * scan to a B when asked at `www` (72 over 6 pages and 76 over 5). Nothing was
 * wrong with either site. We knocked on the wrong door and reported the
 * silence as theirs. A 4% false-failure rate, concentrated in exactly the
 * market where the apex-and-www split is most common.
 *
 * Two rules keep this from becoming a guessing machine:
 *
 * It only fires on a transport error that means "nothing is listening here",
 * never on an HTTP response. A 403 is the site answering, and answering is the
 * measurement — retrying it at another hostname would be working around a
 * refusal, which constraint 1 forbids.
 *
 * It only fires on a hostname where the other spelling is unambiguous. `www.`
 * comes off anything that has it; it only goes on to a bare two-label host.
 * Guessing `www.blog.example.com` from `blog.example.com` would be inventing a
 * hostname nobody mentioned.
 */

/**
 * Whether a transport error means we asked the wrong hostname.
 *
 * The three that qualify all say "there is nothing at this name": the
 * certificate is for someone else, the name does not resolve, or the port is
 * closed. Each one is consistent with the site being alive at its sibling.
 *
 * A timeout deliberately does not qualify. Something is listening and it is
 * slow, which is a finding about that host rather than a reason to try
 * another — and retrying would double the wait before saying so. Nor does a
 * reset mid-body, which means we were already talking to the right server.
 */
export function looksLikeWrongHost(transportError: string): boolean {
  const err = (transportError ?? '').toLowerCase();
  if (!err) return false;
  return (
    err.includes("does not match certificate's altnames") ||
    err.includes('err_tls_cert_altname_invalid') ||
    err.includes('hostname/ip does not match') ||
    err.includes('enotfound') ||
    err.includes('econnrefused')
  );
}

/**
 * The other spelling of this host, or null when there is no unambiguous one.
 *
 * Strips `www.` when present. Adds it only to a bare two-label hostname, which
 * is the case that is safe without a public-suffix list: `example.com` becomes
 * `www.example.com`, while `blog.example.com` and `example.co.uk` return null
 * rather than a hostname we made up. Missing a fallback is a scan that reports
 * what it found; inventing one is a scan that reports somebody else's site.
 */
export function siblingUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  // An address has no www form, and neither does a name with no dot at all.
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null;

  if (host.startsWith('www.')) {
    const bare = host.slice(4);
    // `www.com` would leave a bare TLD. Nothing is served there.
    if (!bare.includes('.')) return null;
    parsed.hostname = bare;
    return parsed.toString();
  }

  if (host.split('.').length !== 2) return null;
  parsed.hostname = `www.${host}`;
  return parsed.toString();
}
