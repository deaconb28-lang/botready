/**
 * The parity rule, which is the product's headline finding.
 *
 * A site that returns 200 to Chrome and 403 to ClaudeBot from the same address
 * in the same second is the single most important thing this scanner reports.
 * That makes the rule deciding it worth pinning, and it had a bug worth
 * pinning against.
 *
 * doctorswithoutborders.org answered 403 to all five clients, the Chrome
 * control included, and scored a B 71. The agreement test used to run before
 * the control test, so uniform refusal read as perfect parity and took full
 * points: five clients treated identically is, arithmetically, no
 * differential treatment at all. The order is the fix and these are the
 * assertions that keep it.
 */

import { describe, expect, it } from 'vitest';

import { parityStatus } from './clients';

describe('the parity rule', () => {
  it('passes when every client got the same 2xx', () => {
    expect(parityStatus(200, [200, 200, 200, 200])).toBe('pass');
  });

  it('treats the class rather than the code, so 200 and 204 agree', () => {
    expect(parityStatus(200, [204, 200, 206, 200])).toBe('pass');
  });

  it('fails when any agent is treated differently from a working control', () => {
    // The headline. Chrome gets in, ClaudeBot does not.
    expect(parityStatus(200, [200, 403, 200, 200])).toBe('fail');
    expect(parityStatus(200, [403, 403, 403, 403])).toBe('fail');
    // heroku.com, observed: 429 to ClaudeBot alone.
    expect(parityStatus(200, [200, 429, 200, 200])).toBe('fail');
    // patagonia.com, observed: 404 to agents and 200 to browsers.
    expect(parityStatus(200, [404, 404, 404, 200])).toBe('fail');
  });

  it('errors when the control could not be reached at all', () => {
    // Our problem. Nothing was measured, so nothing is claimed about the site.
    expect(parityStatus(0, [0, 0, 0, 0])).toBe('error');
    expect(parityStatus(0, [200, 200, 200, 200])).toBe('error');
  });

  /**
   * The regression. Every one of these used to return 'pass'.
   */
  describe('a refused control is never a pass', () => {
    it('does not reward a site that refuses all five clients equally', () => {
      // doctorswithoutborders.org, verbatim.
      expect(parityStatus(403, [403, 403, 403, 403])).toBe('warn');
    });

    it('holds for every refusal class, not just 403', () => {
      expect(parityStatus(401, [401, 401, 401, 401])).toBe('warn');
      expect(parityStatus(429, [429, 429, 429, 429])).toBe('warn');
      // amazon.com, observed: 503 to the agents behind a 202 control.
      expect(parityStatus(503, [503, 503, 503, 503])).toBe('warn');
      expect(parityStatus(404, [404, 404, 404, 404])).toBe('warn');
    });

    it('holds when the agents disagree with the refused control too', () => {
      // Still not this check's finding: the control is the baseline and it is
      // gone, so there is nothing to compare against.
      expect(parityStatus(403, [200, 200, 200, 200])).toBe('warn');
      expect(parityStatus(403, [403, 200, 403, 403])).toBe('warn');
    });

    it('never returns pass for any non-2xx control', () => {
      for (const control of [301, 400, 401, 403, 404, 418, 429, 500, 502, 503]) {
        expect(parityStatus(control, [control, control, control, control]), String(control)).not.toBe('pass');
      }
    });
  });

  it('passes a site with no agent probes at all rather than inventing a verdict', () => {
    // Vacuous, and the honest answer: nothing disagreed with a working control.
    expect(parityStatus(200, [])).toBe('pass');
  });
});
