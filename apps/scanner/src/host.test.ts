/**
 * Knocking on the other door, and knowing when not to.
 *
 * Two Squarespace sites in a batch of fifty north-Seattle businesses recorded
 * a scanner error — salishbrewing.com and hemlockstate.com — because their
 * certificates cover www and not the apex, so TLS verification failed before
 * any HTTP happened. Both scan to a B when asked at www. That is a 4%
 * false-failure rate in the market where the split is most common, and every
 * one of those failures told the owner their site was broken.
 *
 * The risk in fixing it is a scanner that starts guessing hostnames, so both
 * halves are tested: what must fall back, and what must not.
 */

import { describe, expect, it } from 'vitest';

import { looksLikeWrongHost, siblingUrl } from './host';

describe('when a transport error means we asked the wrong hostname', () => {
  it('recognises the certificate mismatch that started this', () => {
    // Verbatim from the salishbrewing.com scan.
    expect(
      looksLikeWrongHost(
        "Hostname/IP does not match certificate's altnames: Host: salishbrewing.com is not in the cert's altnames: DNS:*.squarespace.com, DNS:squarespace.com",
      ),
    ).toBe(true);
  });

  it('recognises a name that does not resolve and a port that is closed', () => {
    expect(looksLikeWrongHost('getaddrinfo ENOTFOUND example.com')).toBe(true);
    expect(looksLikeWrongHost('connect ECONNREFUSED 204.74.99.103:443')).toBe(true);
    expect(looksLikeWrongHost('ERR_TLS_CERT_ALTNAME_INVALID')).toBe(true);
  });

  it('does not treat a slow server as the wrong server', () => {
    // Something is listening and it is slow, which is a finding about that
    // host. Retrying the sibling would double the wait before reporting it —
    // and npr.org, the site this timeout was observed on, fails identically at
    // both spellings.
    expect(looksLikeWrongHost('Your server did not respond within 30s.')).toBe(false);
    expect(looksLikeWrongHost('No response within 14986 ms.')).toBe(false);
  });

  it('does not treat a reset mid-body as the wrong server', () => {
    // We were already talking to the right machine.
    expect(looksLikeWrongHost('socket hang up')).toBe(false);
    expect(looksLikeWrongHost('read ECONNRESET')).toBe(false);
  });

  it('says no when there was no error at all', () => {
    expect(looksLikeWrongHost('')).toBe(false);
  });
});

describe('the other spelling of a hostname', () => {
  it('adds www to a bare two-label domain', () => {
    expect(siblingUrl('https://salishbrewing.com/')).toBe('https://www.salishbrewing.com/');
  });

  it('strips www when it is there', () => {
    expect(siblingUrl('https://www.delta.com/')).toBe('https://delta.com/');
  });

  it('strips www from a deeper name, because removing is never a guess', () => {
    expect(siblingUrl('https://www.blog.example.com/')).toBe('https://blog.example.com/');
  });

  it('keeps the path, port and scheme', () => {
    expect(siblingUrl('https://example.com/pricing?a=1')).toBe('https://www.example.com/pricing?a=1');
    expect(siblingUrl('http://example.com:8080/x')).toBe('http://www.example.com:8080/x');
  });

  it('refuses to invent a hostname for a subdomain', () => {
    // www.blog.example.com is a name nobody mentioned. Missing a fallback
    // reports what we found; inventing one reports somebody else's site.
    expect(siblingUrl('https://blog.example.com/')).toBeNull();
    expect(siblingUrl('https://api.stripe.com/')).toBeNull();
  });

  it('refuses a multi-part public suffix rather than guessing at it', () => {
    // Telling example.co.uk from co.uk needs a public-suffix list, and
    // www.co.uk is not a fallback we want to fetch.
    expect(siblingUrl('https://example.co.uk/')).toBeNull();
  });

  it('leaves an address alone', () => {
    expect(siblingUrl('https://127.0.0.1/')).toBeNull();
    expect(siblingUrl('http://192.168.1.1:3000/')).toBeNull();
  });

  it('does not strip down to a bare TLD', () => {
    expect(siblingUrl('https://www.com/')).toBeNull();
  });

  it('returns null for something that is not a URL', () => {
    expect(siblingUrl('not a url')).toBeNull();
    expect(siblingUrl('')).toBeNull();
  });
});
