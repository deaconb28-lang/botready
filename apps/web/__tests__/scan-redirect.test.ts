/**
 * /scan is a bare path with no page behind it.
 *
 * A scan is always /scan/[id] or /scan/live, but people type and paste the
 * stem, and what they are after is the form on the home page. The redirect
 * lives in next.config.ts so it resolves before React renders. These
 * assertions hold the two things that make it correct: that it fires at all,
 * and that it does not swallow the two real routes underneath it.
 */

import { describe, expect, it } from 'vitest';

import config from '../next.config';

async function redirects() {
  if (!config.redirects) throw new Error('next.config declares no redirects');
  return config.redirects();
}

describe('/scan', () => {
  it('redirects to the home page', async () => {
    const rule = (await redirects()).find((r) => r.source === '/scan');
    expect(rule).toBeDefined();
    expect(rule?.destination).toBe('/');
  });

  it('redirects temporarily, so /scan can become a page later', async () => {
    // A 308 is cached by the browser indefinitely. Anyone who hit /scan once
    // would never reach a real page there again without clearing site data.
    const rule = (await redirects()).find((r) => r.source === '/scan');
    expect(rule?.permanent).toBe(false);
  });

  it('leaves /scan/[id] and /scan/live alone', async () => {
    // path-to-regexp matches '/scan' as an exact path, so the only way to
    // catch a result page here is to add a rule that spans the segment.
    const spanning = (await redirects()).filter(
      (r) => r.source !== '/scan' && r.source.startsWith('/scan'),
    );
    expect(spanning).toEqual([]);
  });
});
