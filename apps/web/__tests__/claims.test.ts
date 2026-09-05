/**
 * Claiming a domain requires proving control and cannot be done by anyone who
 * merely knows the domain name. That is the M8 gate, and it is tested against
 * fake resolvers so the DNS and the homepage are whatever the test says.
 */

import { describe, expect, it } from 'vitest';

import { claimToken, instructions, metaTagPresent, verifyClaim, type Resolvers } from '../lib/claims';

const SECRET = 'test-secret-that-is-long-enough';
const alice = 'user-alice';
const mallory = 'user-mallory';

function resolvers(overrides: Partial<Resolvers> = {}): Resolvers {
  return {
    txt: async () => {
      throw new Error('ENODATA');
    },
    addresses: async () => ['93.184.216.34'],
    fetchHomepage: async () => '<html><head><title>Example</title></head><body></body></html>',
    ...overrides,
  };
}

describe('the token', () => {
  it('is different for every person and every domain', () => {
    const a = claimToken(alice, 'example.com', SECRET);
    expect(claimToken(alice, 'example.com', SECRET)).toBe(a);
    expect(claimToken(mallory, 'example.com', SECRET)).not.toBe(a);
    expect(claimToken(alice, 'other.com', SECRET)).not.toBe(a);
  });

  it('is the same however the domain is written', () => {
    expect(claimToken(alice, 'https://WWW.Example.com/', SECRET)).toBe(claimToken(alice, 'example.com', SECRET));
  });

  it('is not derivable without the secret', () => {
    expect(claimToken(alice, 'example.com', SECRET)).not.toBe(claimToken(alice, 'example.com', 'another'));
  });

  it('is short enough for a TXT record and safe in an attribute', () => {
    const token = claimToken(alice, 'example.com', SECRET);
    expect(token).toMatch(/^botready-verify=[A-Za-z0-9_-]{32}$/);
  });

  it('tells the person exactly where to put it', () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const i = instructions(alice, 'Example.com');
    expect(i.domain).toBe('example.com');
    expect(i.dns).toEqual({ host: '_botready.example.com', hostShort: '_botready', type: 'TXT', value: i.token });
    // The short form is what most DNS panels want typed, and appending the
    // zone to it has to reproduce the fully qualified name exactly.
    expect(`${i.dns.hostShort}.${i.domain}`).toBe(i.dns.host);
    expect(i.meta.tag).toBe(`<meta name="botready-verify" content="${i.token}">`);
  });
});

describe('verifyClaim', () => {
  it('cannot be done by someone who merely knows the domain name', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    // Nothing published anywhere. Knowing "example.com" gets you nothing.
    const result = await verifyClaim(mallory, 'example.com', resolvers());
    expect(result.verified).toBe(false);
    if (result.verified) throw new Error('unreachable');
    expect(result.reason).toMatch(/No TXT record/);
    expect(result.reason).toMatch(/no botready-verify meta tag/);
  });

  it('accepts a TXT record carrying the token, without touching the homepage', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const token = claimToken(alice, 'example.com', SECRET);
    let fetched = false;
    const result = await verifyClaim(
      alice,
      'example.com',
      resolvers({
        txt: async (host) => {
          expect(host).toBe('_botready.example.com');
          return [['unrelated=1'], [token]];
        },
        fetchHomepage: async () => {
          fetched = true;
          return '';
        },
      }),
    );
    expect(result).toEqual({ verified: true, method: 'dns_txt' });
    expect(fetched).toBe(false);
  });

  it('accepts a TXT record split across chunks, which DNS does past 255 bytes', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const token = claimToken(alice, 'example.com', SECRET);
    const result = await verifyClaim(
      alice,
      'example.com',
      resolvers({ txt: async () => [[token.slice(0, 10), token.slice(10)]] }),
    );
    expect(result.verified).toBe(true);
  });

  it('accepts the meta tag on the homepage', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const token = claimToken(alice, 'example.com', SECRET);
    const result = await verifyClaim(
      alice,
      'example.com',
      resolvers({
        fetchHomepage: async (url) => {
          expect(url).toBe('https://example.com/');
          return `<!doctype html><html><head><meta charset="utf-8"><meta name="botready-verify" content="${token}"></head></html>`;
        },
      }),
    );
    expect(result).toEqual({ verified: true, method: 'meta_tag' });
  });

  it("rejects another person's token, published in the right place", async () => {
    // Mallory copies Alice's token off Alice's site and publishes it on a
    // domain Mallory does control. It does not verify for Mallory, because the
    // token is bound to (person, domain) and this is neither pair.
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const alicesToken = claimToken(alice, 'example.com', SECRET);
    const result = await verifyClaim(
      mallory,
      'example.com',
      resolvers({ txt: async () => [[alicesToken]] }),
    );
    expect(result.verified).toBe(false);
  });

  it('refuses to fetch a homepage that resolves to a private address', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    let fetched = false;
    const result = await verifyClaim(
      alice,
      'example.com',
      resolvers({
        addresses: async () => ['93.184.216.34', '10.0.0.5'],
        fetchHomepage: async () => {
          fetched = true;
          return '';
        },
      }),
    );
    expect(result.verified).toBe(false);
    if (result.verified) throw new Error('unreachable');
    expect(result.reason).toMatch(/private address/);
    expect(fetched).toBe(false);
  });

  it('reports a homepage that cannot be read, plainly', async () => {
    process.env.SCANNER_SHARED_SECRET = SECRET;
    const result = await verifyClaim(
      alice,
      'example.com',
      resolvers({
        fetchHomepage: async () => {
          throw new Error('connect ECONNREFUSED');
        },
      }),
    );
    expect(result.verified).toBe(false);
    if (result.verified) throw new Error('unreachable');
    expect(result.reason).toMatch(/could not be read: connect ECONNREFUSED/);
  });
});

describe('metaTagPresent', () => {
  const token = 'botready-verify=abc';

  it.each([
    `<meta name="botready-verify" content="${token}">`,
    `<meta content="${token}" name="botready-verify">`,
    `<META NAME='botready-verify' CONTENT='${token}'>`,
    `<meta name=botready-verify content=${token}>`,
    `<meta name="botready-verify" content="${token}" />`,
  ])('finds %s', (tag) => {
    expect(metaTagPresent(`<head>${tag}</head>`, token)).toBe(true);
  });

  it('does not match a different token, a different name, or a substring', () => {
    expect(metaTagPresent(`<meta name="botready-verify" content="${token}x">`, token)).toBe(false);
    expect(metaTagPresent(`<meta name="verify" content="${token}">`, token)).toBe(false);
    expect(metaTagPresent(`<p>${token}</p>`, token)).toBe(false);
  });
});
