/**
 * Pass B. One headless render, and the comparison that carries the most weight
 * in the catalog.
 *
 * The browser is the only thing in this worker that executes a site's script,
 * and it is the only thing that can leak a process. Two rules hold it together:
 *
 *   1. One shared browser for the life of the worker, launched lazily. Launching
 *      Chromium per scan is most of the cost of a scan.
 *   2. Every context is closed in a finally, and every path out of renderPage
 *      goes through that finally, including a throw. A test runs twenty scans
 *      and asserts the process count does not climb, because "we close it in
 *      the happy path" is how you end up with forty zombie Chromiums on a
 *      512 MB box at three in the morning.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';

import { jsDependencyRatio, readable, type Readable } from '../extract';
import { pinTarget } from '../guard';
import { log } from '../log';
import { env } from '../env';
import { RENDER_TIMEOUT_MS, USER_AGENT } from '../version';

let browser: Browser | null = null;
let launching: Promise<Browser> | null = null;

/**
 * Lazily launched, shared, and reused. Concurrent scans get their own context
 * rather than their own browser: a context is an isolated cookie jar and cache,
 * which is the isolation that matters, and it costs milliseconds instead of
 * seconds.
 */
export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  // A crashed browser leaves a disconnected handle behind. Drop it.
  if (browser) browser = null;

  launching ??= chromium
    .launch({
      ...(env.chromiumExecutable ? { executablePath: env.chromiumExecutable } : {}),
      args: [
        // The worker runs as root in a container, which Chromium's sandbox
        // refuses. The sandbox we actually rely on is the container itself.
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
    .then((launched) => {
      browser = launched;
      launching = null;
      launched.on('disconnected', () => {
        browser = null;
      });
      return launched;
    })
    .catch((err: unknown) => {
      launching = null;
      throw err;
    });

  return launching;
}

export async function closeBrowser(): Promise<void> {
  const current = browser;
  browser = null;
  launching = null;
  if (!current) return;
  try {
    await current.close();
  } catch (err) {
    log.warn('the browser did not close cleanly', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface RenderResult {
  /** The rendered DOM, serialised, so extraction runs the same code as raw. */
  html: string;
  status: number;
  title: string;
  /** Console errors the page produced, as an observation about the page. */
  consoleErrors: string[];
  /** Requests the page made that failed, which is often why it is empty. */
  failedRequests: number;
  renderMs: number;
  /** Set when the render never produced a document. */
  error?: string;
}

/**
 * One page, rendered. Never throws for a page-level problem: a site that hangs
 * or crashes the tab is an observation, and the caller needs the other passes'
 * results either way.
 */
export async function renderPage(url: string): Promise<RenderResult> {
  const startedAt = performance.now();

  // The render goes through the same guard as every fetch. Playwright resolves
  // its own DNS, so the address cannot be pinned the way node:https allows,
  // which means this is a check rather than a pin. Two things make that
  // acceptable: the raw fetch has already resolved and vetted this host
  // moments earlier, and Chromium is not going to be talked into reading a
  // file off our disk by an A record. The check is still worth making, because
  // it stops the browser being pointed at the metadata endpoint outright.
  try {
    await pinTarget(url);
  } catch (err) {
    return {
      html: '',
      status: 0,
      title: '',
      consoleErrors: [],
      failedRequests: 0,
      renderMs: Math.round(performance.now() - startedAt),
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let context: BrowserContext | null = null;

  try {
    const active = await getBrowser();
    context = await active.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 900 },
      // We are measuring what an agent can read, not what a person sees, so
      // there is no reason to download images or fonts.
      javaScriptEnabled: true,
      bypassCSP: false,
      ignoreHTTPSErrors: false,
    });
    context.setDefaultTimeout(RENDER_TIMEOUT_MS);

    const consoleErrors: string[] = [];
    let failedRequests = 0;

    const page = await context.newPage();

    // Images, media and fonts are dropped. They are most of the bytes and none
    // of the readable text, and skipping them keeps the render inside its
    // timeout on heavy marketing pages.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      return route.continue();
    });

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (consoleErrors.length < 10) consoleErrors.push(message.text().slice(0, 300));
    });
    page.on('requestfailed', () => {
      failedRequests += 1;
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: RENDER_TIMEOUT_MS,
    });

    // domcontentloaded first, then a short settle for client-rendered pages.
    // networkidle on its own hangs forever on anything holding a websocket
    // open, which is most of the SPAs this check exists to measure.
    await page
      .waitForLoadState('networkidle', { timeout: 5000 })
      .catch(() => {});

    const html = await page.content();
    const title = await page.title().catch(() => '');

    return {
      html,
      status: response?.status() ?? 0,
      title,
      consoleErrors,
      failedRequests,
      renderMs: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    return {
      html: '',
      status: 0,
      title: '',
      consoleErrors: [],
      failedRequests: 0,
      renderMs: Math.round(performance.now() - startedAt),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Every path out of this function lands here, thrown or returned.
    if (context) {
      await context.close().catch((err: unknown) => {
        log.warn('a browser context did not close', {
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }
}

export interface Comparison {
  raw: Readable;
  rendered: Readable;
  ratio: number;
}

/**
 * The two sides of the headline measurement, extracted by the same code.
 */
export function compare(rawHtml: string, renderedHtml: string, url: string): Comparison {
  const raw = readable(rawHtml, url);
  const rendered = readable(renderedHtml, url);
  return { raw, rendered, ratio: jsDependencyRatio(raw.chars, rendered.chars) };
}
