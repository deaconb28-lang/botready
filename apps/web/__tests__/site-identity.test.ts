/**
 * The site card reads three things off a scan that nothing scores, and one of
 * them decides whether we put someone's site in a frame. Getting that wrong in
 * either direction is visible: a blank rectangle where a preview should be, or
 * a preview of a site that told us not to.
 */

import { describe, expect, it } from 'vitest';

import type { CheckResult } from '@botready/core';

import { siteIdentity } from '../lib/site-identity';

function scan(target: Record<string, unknown>): CheckResult[] {
  return [
    {
      key: 'title_meta_distinct',
      status: 'pass',
      observed: { pages: [{ url: 'https://example.com/', status: 200, ...target }] },
      durationMs: 1,
    },
  ];
}

describe('siteIdentity', () => {
  it('tries the icon the page declared first', () => {
    const id = siteIdentity(scan({ icon: 'https://cdn.example.com/logo.png' }), 'example.com', 'https://example.com/');
    expect(id.iconCandidates[0]).toBe('https://cdn.example.com/logo.png');
  });

  it('falls back to conventional paths on the scanned origin, never a third party', () => {
    const id = siteIdentity(scan({ icon: '' }), 'example.com', 'https://example.com/pricing');
    expect(id.iconCandidates[0]).toBe('https://example.com/favicon.ico');
    expect(id.iconCandidates).toContain('https://example.com/apple-touch-icon.png');
    expect(id.iconCandidates.every((c) => c.startsWith('https://example.com/'))).toBe(true);
  });

  it('does not list the declared icon twice when it is the conventional path', () => {
    const id = siteIdentity(scan({ icon: 'https://example.com/favicon.ico' }), 'example.com', 'https://example.com/');
    expect(id.iconCandidates.filter((c) => c.endsWith('/favicon.ico'))).toHaveLength(1);
  });

  it('carries the page title and description through', () => {
    const id = siteIdentity(scan({ title: '  Example  ', description: 'We do a thing.' }), 'example.com', 'https://example.com/');
    expect(id.title).toBe('Example');
    expect(id.description).toBe('We do a thing.');
  });

  it('records whether the scan itself found a declared icon', () => {
    expect(siteIdentity(scan({ icon: 'https://example.com/i.png' }), 'example.com', 'https://example.com/').declaredIcon).toBe(true);
    expect(siteIdentity(scan({ icon: '' }), 'example.com', 'https://example.com/').declaredIcon).toBe(false);
    expect(siteIdentity([], 'example.com', 'https://example.com/').declaredIcon).toBe(false);
  });

  it('has a monogram for a site whose icon will not load', () => {
    expect(siteIdentity([], 'www.stripe.com', 'https://www.stripe.com/').monogram).toBe('S');
  });

  describe('framing', () => {
    it('is unknown for a scan taken before the headers were recorded', () => {
      expect(siteIdentity(scan({ title: 'Example' }), 'example.com', 'https://example.com/').framing).toBe('unknown');
      expect(siteIdentity([], 'example.com', 'https://example.com/').framing).toBe('unknown');
    });

    it('is allowed when the scan looked and the server sent neither header', () => {
      expect(siteIdentity(scan({ x_frame_options: '', csp: '' }), 'example.com', 'https://example.com/').framing).toBe('allowed');
    });

    it('reads X-Frame-Options', () => {
      for (const value of ['DENY', 'deny', 'SAMEORIGIN', 'sameorigin', 'ALLOW-FROM https://other.example']) {
        expect(siteIdentity(scan({ x_frame_options: value, csp: '' }), 'example.com', 'https://example.com/').framing).toBe('refused');
      }
    });

    it('lets frame-ancestors overrule X-Frame-Options in both directions', () => {
      // A permissive CSP beats a restrictive XFO, which is what a browser does.
      expect(
        siteIdentity(scan({ x_frame_options: 'DENY', csp: "default-src 'self'; frame-ancestors *" }), 'example.com', 'https://example.com/')
          .framing,
      ).toBe('allowed');
      // And a restrictive CSP refuses even with no XFO at all.
      expect(
        siteIdentity(scan({ x_frame_options: '', csp: "frame-ancestors 'self' https://partner.example" }), 'example.com', 'https://example.com/')
          .framing,
      ).toBe('refused');
    });

    it("treats frame-ancestors 'none' as the refusal it is", () => {
      expect(
        siteIdentity(scan({ x_frame_options: '', csp: "frame-ancestors 'none'" }), 'example.com', 'https://example.com/').framing,
      ).toBe('refused');
    });

    it('does not mistake another directive containing the word for frame-ancestors', () => {
      expect(
        siteIdentity(scan({ x_frame_options: '', csp: "script-src 'self'; img-src *" }), 'example.com', 'https://example.com/').framing,
      ).toBe('allowed');
    });
  });
});
