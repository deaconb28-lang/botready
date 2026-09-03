/**
 * The browser has to close on every path out of renderPage, including the ones
 * that throw. This is the test that would have caught forty zombie Chromiums on
 * a 512 MB Railway box at three in the morning.
 *
 * Two things are asserted, because either one alone can pass while leaking:
 *
 *   contexts        a context left open holds its own renderer process, so a
 *                   context count above zero between renders is the leak, even
 *                   when the process count happens to look flat.
 *   process count   the shared browser is one process tree. If the count after
 *                   twenty renders is higher than after one, something spawned
 *                   that nothing closed.
 */

import { execFileSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startFixture, type Fixture } from '../__fixtures__/server';
import { closeBrowser, getBrowser, renderPage } from './render';

let fixture: Fixture;

beforeAll(async () => {
  fixture = await startFixture('good');
  process.env.SCANNER_ALLOW_PRIVATE_HOSTS = `127.0.0.1:${fixture.port}`;
  process.env.SCANNER_PAGE_DELAY_MS = '0';
});

afterAll(async () => {
  await closeBrowser();
  await fixture.close();
  delete process.env.SCANNER_ALLOW_PRIVATE_HOSTS;
  delete process.env.SCANNER_PAGE_DELAY_MS;
});

/** Chromium processes belonging to this container, however many the tree has. */
function chromiumProcesses(): number {
  try {
    const out = execFileSync('ps', ['-eo', 'command'], { encoding: 'utf8' });
    return out.split('\n').filter((line) => /chrome|chromium|headless_shell/i.test(line)).length;
  } catch {
    return -1;
  }
}

describe('renderPage', () => {
  it('renders the fixture and reports what it saw', async () => {
    const result = await renderPage(`${fixture.origin}/`);
    expect(result.status).toBe(200);
    expect(result.html).toContain('<h1>Example</h1>');
    expect(result.error).toBeUndefined();
  });

  it('reports a page that could not be rendered without throwing', async () => {
    // A refused target: the guard says no, and that is an observation.
    const result = await renderPage('http://169.254.169.254/latest/meta-data/');
    expect(result.status).toBe(0);
    expect(result.html).toBe('');
    expect(result.error).toContain('private or reserved address');
  });

  it('closes its context after every render, including the failures', async () => {
    const browser = await getBrowser();

    await renderPage(`${fixture.origin}/`);
    expect(browser.contexts()).toHaveLength(0);

    await renderPage(`${fixture.origin}/nope`);
    expect(browser.contexts()).toHaveLength(0);

    // A URL that resolves nowhere: page.goto throws, and the finally still runs.
    await renderPage('http://127.0.0.1:1/');
    expect(browser.contexts()).toHaveLength(0);
  });

  it('runs twenty scans without leaking a process', async () => {
    fixture.setMode('good');

    // One render first, so the shared browser is up and the baseline is the
    // steady state rather than "before Chromium existed".
    await renderPage(`${fixture.origin}/`);
    const baseline = chromiumProcesses();
    expect(baseline, 'ps did not report anything; the assertion below is meaningless').toBeGreaterThan(0);

    const targets = [
      `${fixture.origin}/`,
      `${fixture.origin}/pricing`,
      `${fixture.origin}/docs`,
      // Interleave the failure paths, because those are the ones that leak.
      'http://127.0.0.1:1/',
      'http://10.0.0.1/',
    ];

    const browser = await getBrowser();

    for (let i = 0; i < 20; i += 1) {
      const target = targets[i % targets.length];
      if (!target) throw new Error('no target');
      await renderPage(target);
      expect(browser.contexts(), `a context survived render ${i + 1}`).toHaveLength(0);
    }

    const after = chromiumProcesses();
    // Chromium's process count moves a little on its own as it recycles
    // utility processes, so this asserts the count did not grow with the
    // iterations rather than demanding an exact match.
    expect(after, `process count went from ${baseline} to ${after} over 20 renders`).toBeLessThanOrEqual(
      baseline + 2,
    );
  });

  it('reuses one browser rather than launching one per render', async () => {
    const first = await getBrowser();
    await renderPage(`${fixture.origin}/`);
    const second = await getBrowser();
    expect(second).toBe(first);
  });

  it('relaunches after the browser is closed, rather than throwing', async () => {
    await closeBrowser();
    const result = await renderPage(`${fixture.origin}/`);
    expect(result.status).toBe(200);
  });
});
