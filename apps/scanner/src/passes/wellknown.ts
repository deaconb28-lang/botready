/**
 * Pass C. The paths an agent looks for before it looks at your HTML.
 *
 * robots.txt, sitemap.xml, llms.txt, llms-full.txt, and the .well-known
 * manifests. Cheap fetches, no browser, and the results feed the fix pack:
 * the generated llms.txt is built from the sitemap this pass reads, and only
 * from the URLs it confirmed returned 200.
 */

import {
  atOrigin,
  catalog,
  type CheckResult,
  type LlmsTxtObserved,
  type SitemapObserved,
} from '@botready/core';

import { crawlSequentially, guardedFetch, type FetchOutcome } from '../fetcher';
import { isAllowed, parseRobots, type ParsedRobots } from '../robots';
import { PAGE_DELAY_MS, ROBOTS_TOKEN } from '../version';

/**
 * The manifests worth asking for. Each is a convention rather than a standard,
 * which is the whole reason the catalog is data: when one of these dies, it
 * leaves this list and the check keeps its key.
 */
const WELL_KNOWN_PATHS = [
  '/.well-known/ai-plugin.json',
  '/.well-known/agent.json',
  '/.well-known/mcp.json',
  '/.well-known/webmcp.json',
];

/** Sitemap URLs we keep, so llms.txt can be built without storing a whole map. */
const MAX_SITEMAP_URLS = 200;

/** Sitemap children we will open. A sitemap index can name hundreds. */
const MAX_SITEMAP_CHILDREN = 2;

/**
 * The robots.txt half of Pass C, which runs before anything else in the scan.
 * Split from the rest on purpose: if the file disallows us, or if the site turns
 * out to answer our user agent with a 403, there is no reason to go on asking it
 * for a sitemap. Continuing to probe a site that has already refused us would be
 * the same discourtesy the product is built to complain about.
 */
export interface RobotsProbe {
  robots: ParsedRobots | null;
  robotsStatus: number;
  robotsBody: string;
  /** Whether our own crawler may read the target path. We obey this. */
  weAreAllowed: boolean;
  ourMatchedRule: string;
  results: CheckResult[];
}

export interface PassCResult {
  sitemap: SitemapObserved;
  llmsTxt: LlmsTxtObserved;
  llmsFullPresent: boolean;
  results: CheckResult[];
}

export async function probeRobots(url: string, targetPath: string): Promise<RobotsProbe> {
  const results: CheckResult[] = [];

  const robotsStartedAt = performance.now();
  const robotsUrl = atOrigin(url, '/robots.txt');
  const robotsResponse = await guardedFetch(robotsUrl);
  const robotsMs = performance.now() - robotsStartedAt;

  const hasRobots = robotsResponse.status >= 200 && robotsResponse.status < 300;
  const parsed = hasRobots ? parseRobots(robotsResponse.body) : null;

  results.push(robotsPresentCheck(robotsResponse, parsed, robotsMs));
  results.push(robotsAgentRulesCheck(robotsResponse, parsed, robotsMs));

  // Our own compliance. Not a check about the site: a rule about us.
  const ours = parsed
    ? isAllowed(parsed, ROBOTS_TOKEN, targetPath)
    : { allowed: true, matchedRule: '', matchedAgent: '' };

  return {
    robots: parsed,
    robotsStatus: robotsResponse.status,
    robotsBody: robotsResponse.body,
    weAreAllowed: ours.allowed,
    ourMatchedRule: ours.matchedRule,
    results,
  };
}

/**
 * The rest of Pass C: the sitemap, llms.txt, and the .well-known manifests.
 * Only reached once robots.txt allowed us and the site answered our first
 * content request.
 */
export async function runPassC(url: string, robots: ParsedRobots | null): Promise<PassCResult> {
  const results: CheckResult[] = [];
  const parsed = robots;

  // ---------------------------------------------------------------- sitemap

  const sitemapStartedAt = performance.now();
  const declared = parsed?.sitemaps ?? [];
  const sitemap = await readSitemap(url, declared);
  const sitemapMs = performance.now() - sitemapStartedAt;

  results.push(sitemapPresentCheck(sitemap, sitemapMs));
  results.push(sitemapLastmodCheck(sitemap, sitemapMs));

  // ---------------------------------------------------------------- llms.txt

  await pause();
  const llmsStartedAt = performance.now();
  const llmsResponse = await guardedFetch(atOrigin(url, '/llms.txt'));
  const llmsTxt = await readLlmsTxt(llmsResponse);
  const llmsMs = performance.now() - llmsStartedAt;

  await pause();
  const llmsFull = await guardedFetch(atOrigin(url, '/llms-full.txt'), { method: 'HEAD' });
  const llmsFullPresent = llmsFull.status >= 200 && llmsFull.status < 300;

  results.push(llmsTxtCheck(llmsTxt, llmsFullPresent, llmsMs));

  // ---------------------------------------------------------------- manifests

  await pause();
  const manifestStartedAt = performance.now();
  const found: string[] = [];
  const probed: Array<{ path: string; status: number }> = [];

  const responses = await crawlSequentially(
    WELL_KNOWN_PATHS.map((path) => atOrigin(url, path)),
    PAGE_DELAY_MS,
    (target) => guardedFetch(target, { method: 'GET' }),
  );

  for (const [index, response] of responses.entries()) {
    const path = WELL_KNOWN_PATHS[index] ?? '';
    probed.push({ path, status: response.status });
    // A 200 that returns the site's HTML error page is not a manifest. Sites
    // that answer every path with 200 are common enough that content type and
    // parseability both have to hold.
    if (response.status >= 200 && response.status < 300 && looksLikeJson(response)) {
      found.push(path);
    }
  }

  results.push({
    key: 'agent_manifest',
    status: found.length > 0 ? 'pass' : 'fail',
    observed: { well_known_paths_found: found, probed },
    durationMs: performance.now() - manifestStartedAt,
  });

  return { sitemap, llmsTxt, llmsFullPresent, results };
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
}

// ------------------------------------------------------------------ robots

function robotsPresentCheck(
  response: FetchOutcome,
  parsed: ParsedRobots | null,
  durationMs: number,
): CheckResult {
  const observed = {
    status: response.status,
    bytes: response.bytes,
    parse_errors: parsed?.parseErrors ?? [],
    sitemap_lines: parsed?.sitemaps.length ?? 0,
    ...(response.transportError ? { transport_error: response.transportError } : {}),
  };

  if (response.status === 0) {
    return { key: 'robots_present', status: 'error', observed, durationMs };
  }
  if (!parsed) {
    return { key: 'robots_present', status: 'fail', observed, durationMs };
  }
  if (parsed.empty) {
    // Present, served, and says nothing. Not a failure, but not a signal either.
    return { key: 'robots_present', status: 'warn', observed, durationMs };
  }
  return {
    key: 'robots_present',
    status: parsed.parseErrors.length > 0 ? 'warn' : 'pass',
    observed,
    durationMs,
  };
}

/**
 * The check that catches the accident: a robots.txt that blocks ClaudeBot and
 * GPTBot while leaving Googlebot alone. Usually nobody decided that. It is what
 * you get from pasting a blocklist off a forum.
 */
function robotsAgentRulesCheck(
  response: FetchOutcome,
  parsed: ParsedRobots | null,
  durationMs: number,
): CheckResult {
  if (!parsed) {
    // No robots.txt means no rules, which means nothing is blocked by rule.
    // That is a pass for this check; the absent file is robots_present's finding.
    return {
      key: 'robots_agent_rules',
      status: response.status === 0 ? 'error' : 'pass',
      observed: { robots_status: response.status, search_crawlers_allowed: true, per_agent: {} },
      durationMs,
    };
  }

  const perAgent: Record<string, { allowed: boolean; matched_rule: string }> = {};
  for (const agent of catalog.agents) {
    const verdict = isAllowed(parsed, agent.ua, '/');
    perAgent[agent.id] = { allowed: verdict.allowed, matched_rule: verdict.matchedRule };
  }

  // Search crawlers as the comparison, because "we blocked AI but not search"
  // is the shape of the mistake and naming it is the remedy.
  const searchCrawlers = ['Googlebot', 'Bingbot'];
  const searchAllowed = searchCrawlers.every((token) => isAllowed(parsed, token, '/').allowed);
  const refused = catalog.agents.filter(
    (a) => a.role === 'agent' && perAgent[a.id]?.allowed === false,
  );

  const observed = {
    robots_status: response.status,
    search_crawlers_allowed: searchAllowed,
    per_agent: perAgent,
    search_crawlers: Object.fromEntries(
      searchCrawlers.map((token) => [token, isAllowed(parsed, token, '/').allowed]),
    ),
  };

  if (refused.length === 0) {
    return { key: 'robots_agent_rules', status: 'pass', observed, durationMs };
  }
  // Refusing reading agents while welcoming search crawlers is the silent
  // failure. Refusing everyone is a decision, and we report it as one.
  return {
    key: 'robots_agent_rules',
    status: searchAllowed ? 'fail' : 'warn',
    observed,
    durationMs,
  };
}

// ------------------------------------------------------------------ sitemap

/**
 * Reads the sitemap, following a sitemap index a bounded number of levels.
 * Tries the URLs robots.txt declared first, because a site that bothered to
 * declare one has told us where the real map is.
 */
async function readSitemap(url: string, declared: string[]): Promise<SitemapObserved> {
  const candidates = [
    ...declared,
    atOrigin(url, '/sitemap.xml'),
    atOrigin(url, '/sitemap_index.xml'),
  ];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    let response: FetchOutcome;
    try {
      response = await guardedFetch(candidate);
    } catch {
      continue; // a declared sitemap on a host we will not open
    }
    if (response.status < 200 || response.status >= 300) continue;

    const parsed = parseSitemapXml(response.body);

    // A sitemap index names other sitemaps rather than pages. Open a couple.
    if (parsed.isIndex && parsed.urls.length > 0) {
      const children = parsed.urls.slice(0, MAX_SITEMAP_CHILDREN);
      const collected: SitemapObserved['urls'] = [];
      for (const child of children) {
        await pause();
        let childResponse: FetchOutcome;
        try {
          childResponse = await guardedFetch(child.loc);
        } catch {
          continue;
        }
        if (childResponse.status < 200 || childResponse.status >= 300) continue;
        collected.push(...parseSitemapXml(childResponse.body).urls);
      }
      if (collected.length > 0) {
        return {
          status: response.status,
          url_count: collected.length,
          has_lastmod: collected.some((u) => Boolean(u.lastmod)),
          urls: collected.slice(0, MAX_SITEMAP_URLS),
        };
      }
    }

    if (parsed.urls.length > 0 || !parsed.isIndex) {
      return {
        status: response.status,
        url_count: parsed.urls.length,
        has_lastmod: parsed.urls.some((u) => Boolean(u.lastmod)),
        urls: parsed.urls.slice(0, MAX_SITEMAP_URLS),
      };
    }
  }

  return { status: 404, url_count: 0, has_lastmod: false, urls: [] };
}

/**
 * A deliberately small XML reader. Sitemaps are a fixed, flat shape, and adding
 * an XML parser to the worker to read two tag names would be a dependency the
 * product has to carry for the life of the repo.
 */
export function parseSitemapXml(xml: string): {
  isIndex: boolean;
  urls: Array<{ loc: string; lastmod: string | null }>;
} {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const urls: Array<{ loc: string; lastmod: string | null }> = [];

  const entryPattern = /<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const entry of xml.matchAll(entryPattern)) {
    const block = entry[2] ?? '';
    const loc = /<loc>\s*([\s\S]*?)\s*<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i.exec(block)?.[1] ?? null;
    urls.push({ loc: decodeXml(loc.trim()), lastmod: lastmod ? lastmod.trim() : null });
  }

  return { isIndex, urls };
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function sitemapPresentCheck(sitemap: SitemapObserved, durationMs: number): CheckResult {
  const observed = {
    status: sitemap.status,
    url_count: sitemap.url_count,
    has_lastmod: sitemap.has_lastmod,
  };
  if (sitemap.status < 200 || sitemap.status >= 300) {
    return { key: 'sitemap_present', status: 'fail', observed, durationMs };
  }
  if (sitemap.url_count === 0) {
    return { key: 'sitemap_present', status: 'fail', observed, durationMs };
  }
  return { key: 'sitemap_present', status: 'pass', observed, durationMs };
}

/**
 * A maintained lastmod has a spread of dates in the past. Every URL sharing one
 * timestamp means the generator stamped the build, not the change, and a
 * timestamp in the future means nothing at all.
 */
function sitemapLastmodCheck(sitemap: SitemapObserved, durationMs: number): CheckResult {
  const withLastmod = sitemap.urls.filter((u) => u.lastmod);
  const dates = withLastmod
    .map((u) => (u.lastmod ? Date.parse(u.lastmod) : Number.NaN))
    .filter((n) => Number.isFinite(n));
  const distinct = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
  const now = Date.now();
  const futureDates = dates.filter((d) => d > now + 60_000).length;

  const observed = {
    distinct_dates: distinct.size,
    future_dates: futureDates,
    urls_with_lastmod: withLastmod.length,
    urls_seen: sitemap.urls.length,
  };

  if (sitemap.url_count === 0) {
    return { key: 'sitemap_lastmod_real', status: 'skip', observed, durationMs };
  }
  if (withLastmod.length === 0) {
    return { key: 'sitemap_lastmod_real', status: 'fail', observed, durationMs };
  }
  // fails when every lastmod is identical or in the future, per checks.json.
  if (futureDates > 0) {
    return { key: 'sitemap_lastmod_real', status: 'fail', observed, durationMs };
  }
  if (distinct.size <= 1 && withLastmod.length > 1) {
    return { key: 'sitemap_lastmod_real', status: 'fail', observed, durationMs };
  }
  // Some URLs carry one and some do not: real but incomplete.
  const status = withLastmod.length < sitemap.urls.length ? 'warn' : 'pass';
  return { key: 'sitemap_lastmod_real', status, observed, durationMs };
}

// ------------------------------------------------------------------ llms.txt

/**
 * llms.txt is markdown, and the part that matters is the links. A file full of
 * 404s is worse than no file, because an agent that trusts it wastes its budget
 * on dead ends, so up to five links are actually opened.
 */
const MAX_LLMS_LINKS_CHECKED = 5;

async function readLlmsTxt(response: FetchOutcome): Promise<LlmsTxtObserved> {
  if (response.status < 200 || response.status >= 300) {
    return { status: response.status, link_count: 0, broken_links: [] };
  }

  // A site answering every path with its HTML shell is not serving llms.txt.
  if (/^\s*<(!doctype|html)/i.test(response.body)) {
    return { status: response.status, link_count: 0, broken_links: [], served_html: true };
  }

  const links = [...response.body.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)]
    .map((m) => m[1])
    .filter((href): href is string => Boolean(href));

  const unique = [...new Set(links)];
  const broken: string[] = [];

  for (const href of unique.slice(0, MAX_LLMS_LINKS_CHECKED)) {
    await pause();
    try {
      const probe = await guardedFetch(href, { method: 'HEAD' });
      if (probe.status === 0 || probe.status >= 400) broken.push(href);
    } catch {
      broken.push(href);
    }
  }

  return { status: response.status, link_count: unique.length, broken_links: broken };
}

function llmsTxtCheck(
  llms: LlmsTxtObserved,
  llmsFullPresent: boolean,
  durationMs: number,
): CheckResult {
  const observed = { ...llms, llms_full_present: llmsFullPresent };

  if (llms.status < 200 || llms.status >= 300) {
    return { key: 'llms_txt_present', status: 'fail', observed, durationMs };
  }
  if (llms.link_count === 0) {
    // Served something, but nothing an agent can follow.
    return { key: 'llms_txt_present', status: 'warn', observed, durationMs };
  }
  if (llms.broken_links.length > 0) {
    return { key: 'llms_txt_present', status: 'warn', observed, durationMs };
  }
  return { key: 'llms_txt_present', status: 'pass', observed, durationMs };
}

function looksLikeJson(response: FetchOutcome): boolean {
  const type = response.headers['content-type'] ?? '';
  if (!/json/i.test(type)) {
    // Some servers mislabel. Fall through to actually parsing it.
    if (!/^\s*[[{]/.test(response.body)) return false;
  }
  try {
    JSON.parse(response.body);
    return true;
  } catch {
    return false;
  }
}
