/**
 * The orchestrator. Runs the passes, writes what it observed, and stops.
 *
 * What this file deliberately does not do:
 *   - compute a score, or import anything that can. Scoring is a pure function
 *     in packages/core, run by the web app over the evidence rows this writes.
 *   - work around a refusal. If robots.txt tells us no, or the site answers our
 *     own user agent with a 403, the scan is recorded as blocked and ends.
 *
 * The order is not arbitrary:
 *
 *   1. robots.txt, because if it says no there is nothing else to do, and
 *      reading a site's sitemap after it asked us not to crawl would make the
 *      claim that we obey robots.txt untrue.
 *   2. the identity fetch: the target, once, as BotreadyBot. This is the request
 *      that decides whether we were refused, and it is also the raw side of the
 *      JS dependency ratio. A site that answers it with a 403 gets no further
 *      requests from us, which is why the rest of Pass C waits behind it.
 *   3. the rest of Pass C: sitemap, llms.txt, the .well-known manifests.
 *   4. Pass A, the five catalog clients, for the comparison that is the product.
 *   5. Pass B, one render, as the same BotreadyBot.
 *   6. the negotiation probe and the extra pages.
 *
 * Both sides of the ratio are the same client on purpose. Comparing Chrome's
 * raw HTML against BotreadyBot's rendered DOM would measure two variables at
 * once, and the check is supposed to isolate one: whether the text survives
 * without JavaScript.
 */

import { MAX_PAGES_PER_SCAN, PAGE_DELAY_MS, ROBOTS_TOKEN, SCANNER_VERSION } from './version';
import { BlockedTargetError } from './guard';
import { domFacts } from './extract';
import { guardedFetch } from './fetcher';
import { log } from './log';
import { loadScan, markFinished, markRunning, writeEvidence } from './db';
import { runPassA } from './passes/clients';
import { probeRobots, runPassC } from './passes/wellknown';
import { compare, renderPage } from './passes/render';
import {
  crawlExtraPages,
  documentChecks,
  probeContentNegotiation,
  type CrawledPage,
} from './passes/document';

import type { CheckResult, CrawlObserved } from '@botready/core';

export interface ScanJob {
  scanId: string;
  url: string;
}

export interface ScanOutcome {
  status: 'complete' | 'blocked' | 'error';
  results: CheckResult[];
  pagesCrawled: number;
  /** Set when we were refused, naming what refused us and how. */
  blockedBy?: string;
  errorMessage?: string;
  /**
   * The origin that answered, when it is not the one asked for. Undefined in
   * the ordinary case, so a value here always means the apex-or-www fallback
   * fired and the reader is looking at a different hostname than they typed.
   */
  effectiveUrl?: string;
}

/**
 * Called with each batch of checks as the scan produces them, so a caller can
 * record progress without waiting for the whole run. Optional: `scan()` is a
 * pure pipeline over a URL and works exactly the same without one.
 */
export type ProgressSink = (batch: CheckResult[]) => Promise<void>;

/**
 * The database-backed entry point, called from the HTTP route. Reads the URL
 * back off the scan row rather than trusting the request body, so a valid
 * signature over a tampered payload still cannot make us fetch something the
 * web app never queued.
 */
export async function runScan(job: ScanJob): Promise<void> {
  const target = await loadScan(job.scanId);
  if (!target) {
    log.error('no scan row for this job', { scanId: job.scanId });
    return;
  }

  await markRunning(job.scanId);
  log.info('scan started', {
    scanId: job.scanId,
    url: target.url,
    scannerVersion: SCANNER_VERSION,
  });

  let outcome: ScanOutcome;
  try {
    outcome = await scan(target.url, async (batch) => {
      await writeEvidence(job.scanId, batch);
    });
  } catch (err) {
    // A crash still has to leave a readable scan row. A scan stuck on 'running'
    // forever is the worst outcome for the result page, which polls.
    log.error('the scan threw', {
      scanId: job.scanId,
      err: err instanceof Error ? err.stack : String(err),
    });
    outcome = {
      status: 'error',
      results: [],
      pagesCrawled: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  await writeEvidence(job.scanId, outcome.results);
  await markFinished(job.scanId, outcome.status, {
    pagesCrawled: outcome.pagesCrawled,
    ...(outcome.blockedBy ? { errorMessage: outcome.blockedBy } : {}),
    ...(outcome.errorMessage ? { errorMessage: outcome.errorMessage } : {}),
    ...(outcome.effectiveUrl ? { effectiveUrl: outcome.effectiveUrl } : {}),
  });

  log.info('scan finished', {
    scanId: job.scanId,
    status: outcome.status,
    checks: outcome.results.length,
    pagesCrawled: outcome.pagesCrawled,
  });
}

/**
 * The scan itself: takes a URL, returns observations. No database, so a test
 * can run a whole scan against a loopback server and read the results back.
 */
export async function scan(url: string, onResults?: ProgressSink): Promise<ScanOutcome> {
  const results: CheckResult[] = [];

  /**
   * Hand each batch to the caller as it is produced, then carry on.
   *
   * A scan takes about half a minute and used to write every row at the end,
   * so /scan/live sat on "0 of 21" for the whole thing and then filled in at
   * once. The checks were always finishing in stages; only the record of them
   * was batched. Flushing per stage makes the number on the loading screen a
   * real one that climbs.
   *
   * Never allowed to fail the scan. A progress write is a nicety; the
   * authoritative write is the one runScan does at the end, and it upserts, so
   * a dropped batch costs nothing but a slower-looking counter.
   */
  const flush = async (batch: CheckResult[]) => {
    if (!onResults || batch.length === 0) return;
    try {
      await onResults(batch);
    } catch {
      // Reported by the caller if it cares. Not this function's business.
    }
  };

  let targetPath: string;
  try {
    const parsed = new URL(url);
    targetPath = `${parsed.pathname}${parsed.search}`;
  } catch {
    return {
      status: 'error',
      results,
      pagesCrawled: 0,
      errorMessage: `${url} is not a URL we can parse.`,
    };
  }

  // ---------------------------------------------------------------- 1. robots.txt

  let robots: Awaited<ReturnType<typeof probeRobots>>;
  try {
    robots = await probeRobots(url, targetPath);
  } catch (err) {
    if (err instanceof BlockedTargetError) {
      return { status: 'error', results, pagesCrawled: 0, errorMessage: err.message };
    }
    throw err;
  }

  results.push(...robots.results);
  await flush(robots.results);

  /**
   * From here on, the host that answered.
   *
   * probeRobots resolves apex-versus-www, because robots.txt is the one URL we
   * may read before knowing whether we may read anything. Every request below
   * has to use its answer: scanning `example.com` after learning that only
   * `www.example.com` is listening would produce a page of transport errors
   * about a hostname we already know is the wrong one.
   *
   * `url` stays in scope deliberately and is only used for the two error
   * messages that are about the request the caller made.
   */
  const target = robots.effectiveUrl;
  const switched = target === url ? {} : { effectiveUrl: target };
  if (target !== url) log.info('the apex did not answer; reading www instead', { asked: url, reading: target });

  if (!robots.weAreAllowed) {
    log.info('robots.txt disallows us, stopping', { url, rule: robots.ourMatchedRule });
    return {
      status: 'blocked',
      results,
      pagesCrawled: 0,
      blockedBy: `Your robots.txt disallows ${ROBOTS_TOKEN} on this path${
        robots.ourMatchedRule ? ` (${robots.ourMatchedRule})` : ''
      }. We stopped there and did not read the page.`,
      ...switched,
    };
  }

  // ---------------------------------------------------------------- 2. identity fetch

  await pause();
  const identity = await guardedFetch(target);

  if (identity.status === 0) {
    return {
      status: 'error',
      results,
      pagesCrawled: 0,
      errorMessage: `We could not reach ${target}. ${identity.transportError ?? 'No response.'}`,
      ...switched,
    };
  }

  if (identity.status === 401 || identity.status === 403 || identity.status === 429) {
    log.info('the site refuses our scanner, stopping', { url: target, status: identity.status });
    const mitigated = identity.headers['cf-mitigated'];
    return {
      status: 'blocked',
      results,
      pagesCrawled: 1,
      blockedBy: `This site answers ${ROBOTS_TOKEN} with HTTP ${identity.status}${
        mitigated ? ` (cf-mitigated: ${mitigated})` : ''
      }. We record that as refused and do not work around it.`,
      ...switched,
    };
  }

  const rawHtml = identity.body;
  const rawFacts = domFacts(rawHtml, target);

  // ---------------------------------------------------------------- 3. the rest of Pass C

  await pause();
  const passC = await runPassC(target, robots.robots);
  results.push(...passC.results);
  await flush(passC.results);

  // ---------------------------------------------------------------- 4. Pass A

  await pause();
  const passA = await runPassA(target);
  results.push(...passA.results);
  await flush(passA.results);

  // ---------------------------------------------------------------- 5. Pass B

  await pause();
  const render = await renderPage(target);
  const renderFailed = Boolean(render.error) || !render.html;

  if (renderFailed) {
    log.warn('the render produced nothing', { url: target, error: render.error });
  }

  const comparison = compare(rawHtml, renderFailed ? '' : render.html, target);
  const renderedFacts = renderFailed ? rawFacts : domFacts(render.html, target);

  // ---------------------------------------------------------------- 6. the rest

  await pause();
  const negotiation = await probeContentNegotiation(target);

  await pause();
  let pages: CrawledPage[] = [];
  let pagesCrawled = 1;
  let crawlObserved: CrawlObserved | null = null;
  try {
    const crawl = await crawlExtraPages(target, {
      rawLinks: rawFacts.links,
      renderedLinks: renderFailed ? [] : renderedFacts.links,
      // The sitemap Pass C already read, so following it costs no extra
      // request. It is a fallback rather than a source: a client arriving at
      // the site has the homepage's links, and the sitemap only if it asks.
      sitemapUrls: passC.sitemap.urls.map((entry) => entry.loc),
      robots: robots.robots,
      renderFailed,
    });
    pages = crawl.pages;
    pagesCrawled = Math.min(crawl.pagesCrawled, MAX_PAGES_PER_SCAN);
    crawlObserved = crawl.observed;
  } catch (err) {
    log.warn('the page crawl stopped early', {
      url,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const documents = documentChecks({
    targetUrl: target,
    rawResponse: identity,
    rawFacts,
    renderedFacts,
    comparison,
    renderFailed,
    pages,
    negotiation,
    crawl: crawlObserved,
  });
  results.push(...documents);
  await flush(documents);

  return { status: 'complete', results, pagesCrawled, ...switched };
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
}
