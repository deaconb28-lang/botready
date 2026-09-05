/**
 * The probe decides two things the card cannot fudge: which icon to load, and
 * whether to put someone's site in a frame at all. A wrong "allowed" is a white
 * rectangle on the result page, so every failure has to land on "unknown".
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { probeSite } = await import('../lib/site-probe');

function page(html: string, headers: Record<string, string> = {}, status = 200, url = 'https://example.com/') {
  return new Response(html, { status, headers: { 'content-type': 'text/html', ...headers } });
}

function answers(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  );
}

/** A fresh origin per test: the probe caches by origin and would answer twice. */
let n = 0;
const origin = () => `https://site-${(n += 1)}.example/`;

afterEach(() => vi.unstubAllGlobals());

describe('probeSite', () => {
  it('reads the declared icon and resolves it against the page', async () => {
    answers(page('<html><head><link rel="icon" href="/Icon_light.png" type="image/png"></head>'));
    const url = origin();
    const probe = await probeSite(url);
    expect(probe.icon).toBe(`${url}Icon_light.png`);
    expect(probe.framing).toBe('allowed');
  });

  it('prefers an apple-touch-icon, which is the one that is not 16 pixels', async () => {
    answers(
      page('<head><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/touch.png"></head>'),
    );
    const url = origin();
    expect((await probeSite(url)).icon).toBe(`${url}touch.png`);
  });

  it('handles single quotes and unquoted attributes', async () => {
    answers(page("<head><link rel='shortcut icon' href=/a.png></head>"));
    const url = origin();
    expect((await probeSite(url)).icon).toBe(`${url}a.png`);
  });

  it('keeps reading past </head>, where Next puts the icon links', async () => {
    // Not a hypothetical: botready.dev's own page closes <head> at byte 1,497
    // and streams <link rel="apple-touch-icon"> at byte 37,763, inside the
    // body, for the browser to hoist. Stopping at </head> found nothing on it.
    const html = `<head><title>x</title></head><body>${'<p>filler</p>'.repeat(3000)}<link rel="apple-touch-icon" href="/apple-icon.png"></body>`;
    answers(page(html));
    const url = origin();
    expect((await probeSite(url)).icon).toBe(`${url}apple-icon.png`);
  });

  it('ignores a data: icon rather than inlining it into our page', async () => {
    answers(page('<head><link rel="icon" href="data:image/png;base64,AAA"></head>'));
    expect((await probeSite(origin())).icon).toBe('');
  });

  it('refuses to frame a site that forbids it', async () => {
    answers(page('<head></head>', { 'x-frame-options': 'SAMEORIGIN' }));
    expect((await probeSite(origin())).framing).toBe('refused');

    answers(page('<head></head>', { 'content-security-policy': "frame-ancestors 'none'" }));
    expect((await probeSite(origin())).framing).toBe('refused');
  });

  it('is unknown when the site will not answer', async () => {
    answers(new Error('ECONNRESET'));
    expect(await probeSite(origin())).toEqual({ icon: '', framing: 'unknown' });
  });

  it('is unknown on a non-200, rather than reading an error page', async () => {
    answers(page('<head><link rel="icon" href="/x.png"></head>', {}, 503));
    expect(await probeSite(origin())).toEqual({ icon: '', framing: 'unknown' });
  });

  it('does not ask at all for an address literal or a non-http scheme', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/', 'https://[::1]/', 'file:///etc/passwd', 'http://localhost/', 'nonsense']) {
      expect(await probeSite(url)).toEqual({ icon: '', framing: 'unknown' });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks once per origin and serves the rest from cache', async () => {
    const fetchSpy = vi.fn(async () => page('<head><link rel="icon" href="/i.png"></head>'));
    vi.stubGlobal('fetch', fetchSpy);
    const url = origin();
    await probeSite(url);
    await probeSite(url);
    await probeSite(`${url}pricing`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
