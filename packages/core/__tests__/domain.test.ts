import { describe, expect, it } from 'vitest';

import {
  InvalidUrlError,
  atOrigin,
  normaliseDomain,
  normaliseTargetUrl,
  originOf,
  sameUrl,
  statusClass,
} from '../src/domain';

describe('normaliseDomain', () => {
  it.each([
    ['https://www.Example.com/pricing?a=1#b', 'example.com'],
    ['Example.COM', 'example.com'],
    ['http://example.com:8443/', 'example.com'],
    ['  example.com/  ', 'example.com'],
    ['example.com.', 'example.com'],
    ['https://user:pass@example.com/', 'example.com'],
    ['https://docs.example.com', 'docs.example.com'],
    // www is stripped, but only the leading label.
    ['https://www.www.example.com', 'www.example.com'],
  ])('reduces %s to %s', (input, expected) => {
    expect(normaliseDomain(input)).toBe(expected);
  });

  it('gives the same answer for every way of writing one domain', () => {
    // The 24 hour cache is keyed on this, so two spellings of one domain have
    // to collide or the cache quietly stops deduplicating.
    const forms = [
      'example.com',
      'EXAMPLE.com',
      'www.example.com',
      'https://example.com',
      'https://www.example.com/',
      'http://www.example.com:80/pricing',
    ];
    expect(new Set(forms.map(normaliseDomain))).toEqual(new Set(['example.com']));
  });
});

describe('normaliseTargetUrl', () => {
  it('adds https when someone types a bare domain', () => {
    expect(normaliseTargetUrl('example.com')).toBe('https://example.com/');
  });

  it('keeps the path and query, and drops the fragment', () => {
    expect(normaliseTargetUrl('example.com/pricing?plan=team#compare')).toBe(
      'https://example.com/pricing?plan=team',
    );
  });

  it.each([
    ['', 'Enter a URL.'],
    ['   ', 'Enter a URL.'],
    ['ftp://example.com', 'not something we will request'],
    ['file:///etc/passwd', 'not something we will request'],
    ['localhost', 'no dot in it'],
    ['https://user:pass@example.com/', 'Remove the credentials'],
  ])('refuses %s and says why', (input, message) => {
    // Errors state what went wrong and what to do, and never apologise.
    expect(() => normaliseTargetUrl(input)).toThrow(InvalidUrlError);
    expect(() => normaliseTargetUrl(input)).toThrow(new RegExp(message, 'i'));
  });
});

describe('URL helpers', () => {
  it('finds the origin', () => {
    expect(originOf('https://example.com/a/b?c=1')).toBe('https://example.com');
    expect(originOf('http://example.com:8080/a')).toBe('http://example.com:8080');
  });

  it('resolves a well-known path against the origin, not the current path', () => {
    // /robots.txt has to land at the root even when the scan started deep.
    expect(atOrigin('https://example.com/docs/guide/', '/robots.txt')).toBe(
      'https://example.com/robots.txt',
    );
  });

  it('compares URLs ignoring the trailing slash and the fragment', () => {
    expect(sameUrl('https://example.com/a', 'https://example.com/a/')).toBe(true);
    expect(sameUrl('https://example.com/a#x', 'https://example.com/a')).toBe(true);
    expect(sameUrl('https://example.com/a', 'https://example.com/b')).toBe(false);
  });
});

describe('statusClass', () => {
  it.each([
    [200, '2xx'],
    [204, '2xx'],
    [301, '3xx'],
    [403, '4xx'],
    [404, '4xx'],
    [500, '5xx'],
    [503, '5xx'],
    [0, 'none'],
  ])('maps %i to %s', (status, expected) => {
    // Every colour in this product is one of these five, which is why the
    // mapping lives in core rather than in a component.
    expect(statusClass(status)).toBe(expected);
  });
});
