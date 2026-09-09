/**
 * The checks that come out of a document rather than out of a status line.
 *
 * Which HTML each one reads is a decision, not an accident:
 *
 *   the rendered DOM   for anything about semantics or structured data, because
 *                      tag managers inject JSON-LD and frameworks mount <main>
 *   the raw response   for anything about what a client that does not run a
 *                      browser can see, which is the whole product
 *   both               for pricing, where the gap between them is the finding
 *
 * The extra pages exist for the checks that need more than one page to mean
 * anything: two pages sharing a title is the finding for title_meta_distinct,
 * and "two hops from the homepage" is not a question you can ask of one page.
 */

import { crawlAccount, originOf, type CheckResult, type CrawlObserved, type JsDependencyObserved } from '@botready/core';

import { domFacts, type DomFacts } from '../extract';
import { crawlSequentially, guardedFetch, type FetchOutcome } from '../fetcher';
import { isAllowed, type ParsedRobots } from '../robots';
import type { Comparison } from './render';
import { MAX_PAGES_PER_SCAN, PAGE_DELAY_MS, ROBOTS_TOKEN } from '../version';

/**
 * Paths worth spending part of the page budget on, in priority order. Pricing
 * first because a price an agent cannot read is the most expensive thing on a
 * site to get wrong, then docs, then the rest.
 */
const PREFERRED_PATHS = [
  /^\/pricing/i,
  /^\/(docs|documentation)/i,
  /^\/(api|developers?|reference)/i,
  /^\/(about|company)/i,
  /^\/(blog|changelog|news|updates|releases)/i,
];

export interface CrawledPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  facts: DomFacts;
  fromHomepage: boolean;
}

export interface PageCrawlResult {
  pages: CrawledPage[];
  /** Distinct content pages read, the target included. Capped at six. */
  pagesCrawled: number;
  /** What the crawl counted, for the check and for the explanation. */
  observed: CrawlObserved;
}

export interface CrawlInput {
  /** Internal links in the HTML as sent, before any script ran. */
  rawLinks: string[];
  /** Internal links in the rendered DOM. The superset, and what we follow. */
  renderedLinks: string[];
  /** URLs the sitemap offered, used when the homepage offers too few. */
  sitemapUrls: string[];
  /** Their robots.txt, obeyed per candidate rather than only for the target. */
  robots: ParsedRobots | null;
  /** Whether our headless browser produced a document at all. */
  renderFailed: boolean;
}

/**
 * The page budget, spent here and nowhere else.
 *
 * "Six pages" means six distinct content pages. Pass A's five fetches are five
 * requests for one page, and Pass C's probes are metadata files rather than
 * pages, so neither spends the budget. Every request in the scan is still
 * sequential and a second apart, which is the constraint that actually protects
 * the site being measured.
 */
export async function crawlExtraPages(targetUrl: string, input: CrawlInput): Promise<PageCrawlResult> {
  const origin = originOf(targetUrl);
  const budget = MAX_PAGES_PER_SCAN - 1; // the target is page one

  const raw = rankInternalLinks(input.rawLinks, targetUrl, origin);
  const rendered = rankInternalLinks(input.renderedLinks, targetUrl, origin);
  const sitemap = rankInternalLinks(input.sitemapUrls, targetUrl, origin);

  // The rendered DOM is what we follow, because the object is to read as much
  // of the site as we can. The raw list is counted rather than followed: the
  // gap between the two is the finding, and it is measured in the check.
  //
  // The sitemap is a fallback rather than a first source. A homepage's links
  // are what a client arriving at the site actually has, and the sitemap is
  // what it has if it thinks to ask — so the order here is the order an agent
  // would try, and the sitemap is why several sites now read six pages that
  // used to read one.
  const preferred = rendered.length > 0 ? rendered : raw;
  const candidates = [...new Set([...preferred, ...sitemap])];

  // robots.txt, per candidate. It was only ever consulted for the target,
  // which meant a site that allows / and disallows /search got its /search
  // fetched — by a crawler whose own page promises it reads robots on every
  // scan and stops. This is that promise, applied where it was missing.
  const blocked: string[] = [];
  const allowed: string[] = [];
  for (const candidate of candidates) {
    const path = pathOf(candidate);
    const verdict = input.robots ? isAllowed(input.robots, ROBOTS_TOKEN, path) : null;
    if (verdict && !verdict.allowed) blocked.push(candidate);
    else allowed.push(candidate);
  }

  const taken = allowed.slice(0, budget);

  const responses = await crawlSequentially(taken, PAGE_DELAY_MS, (url) =>
    guardedFetch(url).catch(
      (): FetchOutcome => ({
        url,
        requestedUrl: url,
        status: 0,
        headers: {},
        body: '',
        bytes: 0,
        ttfbMs: 0,
        totalMs: 0,
        redirects: [],
        truncated: false,
        transportError: 'We would not open this URL.',
      }),
    ),
  );

  const pages: CrawledPage[] = responses.map((response) => ({
    url: response.url,
    status: response.status,
    headers: response.headers,
    html: response.body,
    facts: domFacts(response.body, response.url),
    fromHomepage: true,
  }));

  const readable = pages.filter((page) => page.status >= 200 && page.status < 400);

  const observed: CrawlObserved = {
    budget,
    pages_read: readable.length,
    raw_links: raw.length,
    rendered_links: rendered.length,
    off_origin_links: countOffOrigin(
      input.renderedLinks.length > 0 ? input.renderedLinks : input.rawLinks,
      targetUrl,
      origin,
    ),
    sitemap_urls: sitemap.length,
    robots_blocked: blocked.length,
    attempted: taken.length,
    failed: pages.length - readable.length,
    no_response: pages.filter((page) => page.status === 0).length,
    render_failed: input.renderFailed,
  };

  // Pages read, not pages requested. Five dead links used to report "6 of 6",
  // which said we had read the site when we had read one page of it.
  return { pages, pagesCrawled: 1 + readable.length, observed };
}

/** The path a candidate URL asks for, which is what robots.txt matches on. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Links that are links and point somewhere else.
 *
 * Counted because "every link on this page leaves the site" and "this page has
 * no links" are different findings with the same page count, and the first one
 * is common on a single-page site whose booking lives on a platform.
 */
function countOffOrigin(hrefs: string[], baseUrl: string, origin: string): number {
  let off = 0;
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (url.origin !== origin) off += 1;
  }
  return off;
}

/**
 * Internal links, deduplicated, preferred paths first. Anchors, queries and
 * trailing slashes are normalised away, because spending a page of the budget
 * on `/pricing#plans` after already reading `/pricing` is a wasted request.
 */
export function rankInternalLinks(hrefs: string[], baseUrl: string, origin: string): string[] {
  const seen = new Set<string>();
  const scored: Array<{ url: string; rank: number }> = [];
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');

  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

    url.hash = '';
    url.search = '';
    const path = url.pathname.replace(/\/$/, '');
    if (path === basePath) continue;
    // Files, not pages.
    if (/\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|json|xml|txt|woff2?)$/i.test(path)) continue;

    const normalised = `${url.origin}${path || '/'}`;
    if (seen.has(normalised)) continue;
    seen.add(normalised);

    const preferred = PREFERRED_PATHS.findIndex((pattern) => pattern.test(path || '/'));
    scored.push({
      url: normalised,
      // Preferred paths in order, then anything else by depth: a shallow page
      // is more likely to be one that matters.
      rank: preferred >= 0 ? preferred : PREFERRED_PATHS.length + path.split('/').length,
    });
  }

  return scored.sort((a, b) => a.rank - b.rank).map((s) => s.url);
}

// ------------------------------------------------------------------ checks

export interface DocumentCheckInput {
  targetUrl: string;
  /** The Chrome control's raw response. */
  rawResponse: FetchOutcome;
  rawFacts: DomFacts;
  renderedFacts: DomFacts;
  comparison: Comparison;
  renderFailed: boolean;
  pages: CrawledPage[];
  /** The Accept: text/markdown probe, run once against the target. */
  negotiation: FetchOutcome | null;
  /** What the page crawl counted. Null when the crawl itself threw. */
  crawl: CrawlObserved | null;
}

export function documentChecks(input: DocumentCheckInput): CheckResult[] {
  return [
    jsDependencyCheck(input),
    markdownAlternateCheck(input),
    semanticLandmarksCheck(input),
    titleMetaDistinctCheck(input),
    contentNegotiationCheck(input),
    jsonLdCheck(input),
    pricingStructuredCheck(input),
    canonicalOgCheck(input),
    apiDocsCheck(input),
    formSemanticsCheck(input),
    noWallOnDocsCheck(input),
    contactReachableCheck(input),
    actionDeclaredCheck(input),
    actionNotJsOnlyCheck(input),
    pagesReachableCheck(input),
  ];
}

/**
 * Whether a client that does not run a browser can reach a second page.
 *
 * Forty-three of the 342 complete scans in the corpus read exactly one page,
 * and the report said "1 of 6 allowed" and nothing else — so the reader could
 * not tell whether the limit was their site or our scanner. Those are opposite
 * conclusions, and we were holding the facts to separate them.
 *
 * A site an agent can only see one page of is a site an agent cannot answer
 * questions about, so where the limit is the site's this is worth points. Where
 * it is ours — our cap, our timeout, nothing answering — it is a skip, because
 * charging a site for our infrastructure would make the score a measure of us.
 *
 * The gradation is not "how many pages" but "can a non-executing client get
 * past the first one". A three-page brochure site passes. A site with thirty
 * links that exist only after React mounts does not, and that is the same
 * finding as js_dependency_ratio arriving by a different route: there, the
 * words are missing; here, the way to the rest of the site is.
 */
function pagesReachableCheck(input: DocumentCheckInput): CheckResult {
  const o = input.crawl;
  // The crawl threw, so we do not know what the site offers. A skip rather
  // than an error: error is zero points inside the denominator, and this is
  // our exception rather than anything about the site. Charging five points
  // for it would make the score partly a measure of our own uptime.
  if (!o) {
    return { key: 'pages_reachable', status: 'skip', observed: { crawl: 'did not run' }, durationMs: 0 };
  }

  const account = crawlAccount(o);
  const observed = { ...o, limit: account.limit };

  // Ours, not theirs: the cap we set, a site with genuinely few pages, or a
  // round of requests that nothing answered.
  if (!account.onTheSite) {
    const ours = account.limit === 'fetches_failed';
    return { key: 'pages_reachable', status: ours ? 'skip' : 'pass', observed, durationMs: 0 };
  }

  // Their robots.txt is a decision they made and we obeyed. It has the same
  // consequence as a broken link — an agent reads one page — but it is not a
  // defect, and a fail would read as one.
  if (account.limit === 'robots_disallowed') {
    return { key: 'pages_reachable', status: 'warn', observed, durationMs: 0 };
  }

  return { key: 'pages_reachable', status: 'fail', observed, durationMs: 0 };
}

/**
 * Whether a person is reachable in a form an agent can hand over.
 *
 * The most common thing anybody asks an assistant about a business is how to
 * reach it, and this was not measured at all. Actionability was four checks —
 * an agent manifest, API docs, form semantics, a wall on docs — three of which
 * a bakery can only fail or be exempted from. 38 of 44 local businesses in the
 * last sweep scored zero on the category, which is not a signal, it is a wall:
 * nothing to act on and no way to show progress.
 *
 * A phone number in an image is not a finding about design, it is a number an
 * agent cannot pass on. So the gradation is about machine-readability rather
 * than about having a phone: a link is usable, a link plus structured data is
 * unambiguous, and neither is a fail somebody can fix this afternoon.
 */
function contactReachableCheck(input: DocumentCheckInput): CheckResult {
  const f = input.renderedFacts;
  const linked = f.telLinks > 0 || f.mailtoLinks > 0;
  const observed = {
    tel_links: f.telLinks,
    mailto_links: f.mailtoLinks,
    json_ld_contact: f.jsonLdContact,
  };

  if (f.jsonLdContact && linked) {
    return { key: 'contact_reachable', status: 'pass', observed, durationMs: 0 };
  }
  if (f.jsonLdContact || linked) {
    return { key: 'contact_reachable', status: 'warn', observed, durationMs: 0 };
  }
  return { key: 'contact_reachable', status: 'fail', observed, durationMs: 0 };
}

/**
 * Whether the site says what can be done here, not only what it is.
 *
 * A schema.org Action — OrderAction, ReserveAction — is a site stating that
 * booking or ordering is possible and where. An Offer is weaker and still
 * worth partial credit: it says what is sold without saying how to get it,
 * which is a description rather than an action.
 *
 * This is the check most sites can pass with one block of JSON-LD, which is
 * exactly what the fix pack generates.
 */
function actionDeclaredCheck(input: DocumentCheckInput): CheckResult {
  const f = input.renderedFacts;
  const observed = { action_types: f.actionTypes, offer_nodes: f.offerNodes };

  if (f.actionTypes.length > 0) {
    return { key: 'action_declared', status: 'pass', observed, durationMs: 0 };
  }
  if (f.offerNodes > 0) {
    return { key: 'action_declared', status: 'warn', observed, durationMs: 0 };
  }
  return { key: 'action_declared', status: 'fail', observed, durationMs: 0 };
}

/**
 * Whether the way to act survives without JavaScript.
 *
 * Same comparison as the JS dependency ratio, asked of the actionable parts
 * rather than of the prose: a booking button that appears only once a script
 * has run is a button no non-rendering client can find.
 *
 * Skips when neither the raw response nor the rendered DOM has anything to
 * act on. The two checks above already fail for that absence, and failing this
 * one as well would charge a site three times for one missing phone number.
 */
function actionNotJsOnlyCheck(input: DocumentCheckInput): CheckResult {
  const actionable = (f: DomFacts) => ({
    contacts: f.telLinks + f.mailtoLinks + (f.jsonLdContact ? 1 : 0),
    actions: f.actionTypes.length,
  });
  const raw = actionable(input.rawFacts);
  const rendered = actionable(input.renderedFacts);
  const observed = {
    raw_contacts: raw.contacts,
    rendered_contacts: rendered.contacts,
    raw_actions: raw.actions,
    rendered_actions: rendered.actions,
  };

  // A failed render leaves nothing to compare against, and the JS dependency
  // check already reports the render itself as the problem.
  if (input.renderFailed) {
    return { key: 'action_not_js_only', status: 'skip', observed, durationMs: 0 };
  }
  if (rendered.contacts === 0 && rendered.actions === 0) {
    return { key: 'action_not_js_only', status: 'skip', observed, durationMs: 0 };
  }
  if (raw.contacts === 0 && raw.actions === 0) {
    return { key: 'action_not_js_only', status: 'fail', observed, durationMs: 0 };
  }
  if (rendered.contacts > raw.contacts || rendered.actions > raw.actions) {
    return { key: 'action_not_js_only', status: 'warn', observed, durationMs: 0 };
  }
  return { key: 'action_not_js_only', status: 'pass', observed, durationMs: 0 };
}

function jsDependencyCheck(input: DocumentCheckInput): CheckResult {
  const { comparison, renderFailed } = input;
  const observed: JsDependencyObserved & Record<string, unknown> = {
    raw_chars: comparison.raw.chars,
    rendered_chars: comparison.rendered.chars,
    ratio: comparison.ratio,
    raw_extraction_failed: comparison.raw.extractionFailed,
    rendered_extraction_failed: comparison.rendered.extractionFailed,
    // The first few hundred characters of what each side read, so the page
    // detail view can show the two texts beside the two counts. An excerpt
    // is a fact about the response; it is not kept beyond this length.
    raw_excerpt: excerpt(comparison.raw.text),
    rendered_excerpt: excerpt(comparison.rendered.text),
  };

  // Without a render there is nothing to compare against, and reporting 0
  // would say "no JavaScript dependency" when what happened is "we could not
  // measure". This is the case the error status exists for.
  if (renderFailed || comparison.rendered.chars === 0) {
    return { key: 'js_dependency_ratio', status: 'error', observed, durationMs: 0 };
  }

  // fails above 0.7, warns between 0.4 and 0.7, per checks.json.
  const status =
    comparison.ratio > 0.7 ? 'fail' : comparison.ratio >= 0.4 ? 'warn' : 'pass';
  return { key: 'js_dependency_ratio', status, observed, durationMs: 0 };
}

function markdownAlternateCheck(input: DocumentCheckInput): CheckResult {
  const linkHeader = input.rawResponse.headers['link'] ?? '';
  const headerAdvertises = /type\s*=\s*"?text\/(x-)?markdown"?/i.test(linkHeader);
  // The tag can be in either document. A tag only present after render is
  // still a tag, but it is one a plain fetch never sees, so both are recorded.
  const tagInRaw = input.rawFacts.markdownLinkTag;
  const tagInRendered = input.renderedFacts.markdownLinkTag;

  const negotiated = negotiationSucceeded(input.negotiation);

  const observed = {
    link_tag: tagInRaw || tagInRendered,
    link_tag_in_raw_html: tagInRaw,
    link_tag_after_render: tagInRendered,
    link_header: headerAdvertises,
    link_header_value: linkHeader.slice(0, 300),
    accept_negotiation: negotiated,
  };

  if (tagInRaw || headerAdvertises || negotiated) {
    return { key: 'markdown_alternate', status: 'pass', observed, durationMs: 0 };
  }
  if (tagInRendered) {
    // Advertised, but only to a client that ran the page's JavaScript, which is
    // not the client this check is about.
    return { key: 'markdown_alternate', status: 'warn', observed, durationMs: 0 };
  }
  return { key: 'markdown_alternate', status: 'fail', observed, durationMs: 0 };
}

function semanticLandmarksCheck(input: DocumentCheckInput): CheckResult {
  const facts = input.renderFailed ? input.rawFacts : input.renderedFacts;
  const observed = {
    h1_count: facts.h1Count,
    heading_order_breaks: facts.headingOrderBreaks,
    has_main: facts.hasMain,
    headings: facts.headings,
    heading_ids: facts.headingIds,
    read_from: input.renderFailed ? 'raw_html' : 'rendered_dom',
  };

  const problems =
    (facts.h1Count === 1 ? 0 : 1) + (facts.hasMain ? 0 : 1) + (facts.headingOrderBreaks > 0 ? 1 : 0);

  if (facts.headings === 0 && !facts.hasMain) {
    // Nothing structural at all. Usually a page that did not render for us.
    return { key: 'semantic_landmarks', status: 'fail', observed, durationMs: 0 };
  }
  const status = problems === 0 ? 'pass' : problems === 1 ? 'warn' : 'fail';
  return { key: 'semantic_landmarks', status, observed, durationMs: 0 };
}

function titleMetaDistinctCheck(input: DocumentCheckInput): CheckResult {
  // The status travels with each page because the fix pack reads this: the
  // generated llms.txt may only name URLs the scan actually saw return 200,
  // and this is the only place that fact is recorded per URL.
  const target = {
    url: input.targetUrl,
    status: input.rawResponse.status,
    title: input.renderFailed ? input.rawFacts.title : input.renderedFacts.title,
    description: input.renderFailed
      ? input.rawFacts.metaDescription
      : input.renderedFacts.metaDescription,
    // Three facts about the target page that nothing scores and the result
    // page shows. They ride on this check because this is already the record
    // of how the home page describes itself, and adding a check to carry them
    // would mean a catalog version whose weights did not change.
    //
    // The two header values are printed as the server sent them. Whether they
    // add up to "this page can be put in a frame" is a reading of them, and a
    // reading is not an observation.
    icon: input.renderFailed ? input.rawFacts.icon : input.renderedFacts.icon,
    x_frame_options: input.rawResponse.headers['x-frame-options'] ?? '',
    csp: input.rawResponse.headers['content-security-policy'] ?? '',
  };
  const others = input.pages
    .filter((p) => p.status >= 200 && p.status < 300)
    .map((p) => ({
      url: p.url,
      status: p.status,
      title: p.facts.title,
      description: p.facts.metaDescription,
    }));

  const pages = [target, ...others];
  const observed = { pages };

  if (pages.length === 1) {
    // One page tells us whether it has a title, not whether titles are
    // distinct. Judge what we can see and say so.
    if (!target.title) {
      return { key: 'title_meta_distinct', status: 'fail', observed, durationMs: 0 };
    }
    return {
      key: 'title_meta_distinct',
      status: target.description ? 'pass' : 'warn',
      observed,
      durationMs: 0,
    };
  }

  const missing = pages.filter((p) => !p.title || !p.description).length;
  const titles = pages.map((p) => p.title.trim().toLowerCase()).filter(Boolean);
  const descriptions = pages.map((p) => p.description.trim().toLowerCase()).filter(Boolean);
  const duplicateTitles = titles.length - new Set(titles).size;
  const duplicateDescriptions = descriptions.length - new Set(descriptions).size;

  const detail = {
    ...observed,
    pages_compared: pages.length,
    missing_title_or_description: missing,
    duplicate_titles: duplicateTitles,
    duplicate_descriptions: duplicateDescriptions,
  };

  if (duplicateTitles > 0 || missing > pages.length / 2) {
    return { key: 'title_meta_distinct', status: 'fail', observed: detail, durationMs: 0 };
  }
  if (duplicateDescriptions > 0 || missing > 0) {
    return { key: 'title_meta_distinct', status: 'warn', observed: detail, durationMs: 0 };
  }
  return { key: 'title_meta_distinct', status: 'pass', observed: detail, durationMs: 0 };
}

function contentNegotiationCheck(input: DocumentCheckInput): CheckResult {
  const probe = input.negotiation;
  const observed = {
    status: probe?.status ?? 0,
    content_type: probe?.headers['content-type'] ?? '',
    bytes: probe?.bytes ?? 0,
    differs_from_html: false,
  };

  if (!probe) {
    return { key: 'content_negotiation', status: 'skip', observed, durationMs: 0 };
  }
  if (probe.status === 0) {
    return { key: 'content_negotiation', status: 'error', observed, durationMs: probe.totalMs };
  }

  const negotiated = negotiationSucceeded(probe);
  observed.differs_from_html = negotiated;

  // Almost every server ignores this header, so failing it would put a red mark
  // on most of the internet for not implementing a convention that is weeks
  // old. It is worth three points and a warn.
  return {
    key: 'content_negotiation',
    status: negotiated ? 'pass' : 'warn',
    observed,
    durationMs: probe.totalMs,
  };
}

function negotiationSucceeded(probe: FetchOutcome | null): boolean {
  if (!probe) return false;
  if (probe.status < 200 || probe.status >= 300) return false;
  const type = probe.headers['content-type'] ?? '';
  if (/text\/(x-)?markdown/i.test(type)) return true;
  // Some servers send text/plain with markdown in it. Accept that only when the
  // body is plainly not HTML.
  if (/text\/plain/i.test(type) && !/^\s*<(!doctype|html)/i.test(probe.body)) return true;
  return false;
}

function jsonLdCheck(input: DocumentCheckInput): CheckResult {
  const facts = input.renderFailed ? input.rawFacts : input.renderedFacts;
  const observed = {
    types: facts.jsonLdTypes,
    errors: facts.jsonLdErrors,
    types_in_raw_html: input.rawFacts.jsonLdTypes,
  };

  if (facts.jsonLdTypes.length === 0) {
    return { key: 'jsonld_present', status: 'fail', observed, durationMs: 0 };
  }
  if (facts.jsonLdErrors.length > 0) {
    return { key: 'jsonld_present', status: 'warn', observed, durationMs: 0 };
  }
  // A block that only says WebSite or WebPage describes the medium rather than
  // the thing, which is the state most sites are in and worth partial credit.
  const describesSomething = facts.jsonLdTypes.some(
    (type) => !['WebSite', 'WebPage', 'BreadcrumbList', 'SearchAction'].includes(type),
  );
  return {
    key: 'jsonld_present',
    status: describesSomething ? 'pass' : 'warn',
    observed,
    durationMs: 0,
  };
}

function pricingStructuredCheck(input: DocumentCheckInput): CheckResult {
  // A dedicated pricing page is the better place to look, and the crawl
  // prioritises fetching one. It was fetched without a browser, so its facts
  // are raw facts: the gap between raw and rendered is only available for the
  // target itself.
  const pricingPage = input.pages.find((p) => /\/pricing/i.test(p.url));

  const observed = {
    offer_nodes: pricingPage ? pricingPage.facts.offerNodes : input.renderedFacts.offerNodes,
    prices_in_raw_html: pricingPage ? pricingPage.facts.priceMatches : input.rawFacts.priceMatches,
    prices_after_render: pricingPage
      ? pricingPage.facts.priceMatches
      : input.renderedFacts.priceMatches,
    read_from: pricingPage ? pricingPage.url : input.targetUrl,
  };

  if (observed.offer_nodes > 0) {
    return { key: 'pricing_structured', status: 'pass', observed, durationMs: 0 };
  }
  if (observed.prices_in_raw_html > 0) {
    // Readable, but only as text. A machine has to guess which number is the
    // price and what it buys.
    return { key: 'pricing_structured', status: 'warn', observed, durationMs: 0 };
  }
  if (observed.prices_after_render > 0) {
    // Prices exist and a plain fetch cannot see them at all.
    return { key: 'pricing_structured', status: 'fail', observed, durationMs: 0 };
  }
  // No prices anywhere we looked. Not every site sells something, so this is
  // not the site's failure and it is removed from the denominator.
  return { key: 'pricing_structured', status: 'skip', observed, durationMs: 0 };
}

function canonicalOgCheck(input: DocumentCheckInput): CheckResult {
  const facts = input.renderFailed ? input.rawFacts : input.renderedFacts;
  const wanted = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
  const missing = wanted.filter((property) => !facts.ogPresent.includes(property));

  const observed = { canonical: facts.canonical, og_missing: missing, og_present: facts.ogPresent };

  if (!facts.canonical && missing.length === wanted.length) {
    return { key: 'canonical_og', status: 'fail', observed, durationMs: 0 };
  }
  if (!facts.canonical || missing.length > 2) {
    return { key: 'canonical_og', status: 'warn', observed, durationMs: 0 };
  }
  return {
    key: 'canonical_og',
    status: missing.length === 0 ? 'pass' : 'warn',
    observed,
    durationMs: 0,
  };
}

/**
 * "Two hops from the homepage" means: linked from the homepage, or linked from
 * a page that is linked from the homepage. We have the homepage's links and the
 * links of every page we crawled, so both hops are answerable without spending
 * another request.
 */
function apiDocsCheck(input: DocumentCheckInput): CheckResult {
  const origin = originOf(input.targetUrl);
  const isApiDocs = (href: string) => /\/(api|docs|documentation|developers?|reference)\b/i.test(href);

  const firstHop = input.rawFacts.links
    .concat(input.renderedFacts.links)
    .flatMap((href) => {
      const resolved = absolute(href, input.targetUrl);
      return resolved && resolved.startsWith(origin) ? [resolved] : [];
    })
    .find(isApiDocs);

  if (firstHop) {
    return {
      key: 'api_docs_reachable',
      status: 'pass',
      observed: { hops: 1, url: firstHop },
      durationMs: 0,
    };
  }

  for (const page of input.pages) {
    const secondHop = page.facts.links
      .flatMap((href) => {
        const resolved = absolute(href, page.url);
        return resolved && resolved.startsWith(origin) ? [resolved] : [];
      })
      .find(isApiDocs);
    if (secondHop) {
      return {
        key: 'api_docs_reachable',
        status: 'pass',
        observed: { hops: 2, url: secondHop, via: page.url },
        durationMs: 0,
      };
    }
  }

  return {
    key: 'api_docs_reachable',
    status: 'fail',
    observed: { hops: null, url: '', pages_searched: input.pages.length + 1 },
    durationMs: 0,
  };
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function formSemanticsCheck(input: DocumentCheckInput): CheckResult {
  const facts = input.renderFailed ? input.rawFacts : input.renderedFacts;
  // Forms with no fields are search boxes and newsletter signups wearing a
  // <form>. The check is about primary conversion forms, so anything with fewer
  // than two fields is not one.
  const forms = facts.forms.filter((form) => form.fields >= 2);

  const observed = {
    forms: forms.map((form) => ({
      action: form.action,
      fields: form.fields,
      labelled: form.labelled,
      named: form.named,
      with_autocomplete: form.withAutocomplete,
    })),
    forms_seen: facts.forms.length,
  };

  if (forms.length === 0) {
    // Nothing to judge. Not a failure: plenty of good sites have no form on the
    // page we were pointed at.
    return { key: 'form_semantics', status: 'skip', observed, durationMs: 0 };
  }

  const fields = forms.reduce((sum, f) => sum + f.fields, 0);
  const labelled = forms.reduce((sum, f) => sum + f.labelled, 0);
  const named = forms.reduce((sum, f) => sum + f.named, 0);
  const autocomplete = forms.reduce((sum, f) => sum + f.withAutocomplete, 0);

  const labelledRatio = labelled / fields;
  const namedRatio = named / fields;
  const autocompleteRatio = autocomplete / fields;

  if (labelledRatio < 0.5 || namedRatio < 0.5) {
    return { key: 'form_semantics', status: 'fail', observed, durationMs: 0 };
  }
  if (labelledRatio < 1 || namedRatio < 1 || autocompleteRatio < 0.5) {
    return { key: 'form_semantics', status: 'warn', observed, durationMs: 0 };
  }
  return { key: 'form_semantics', status: 'pass', observed, durationMs: 0 };
}

/**
 * A 401, 403 or a challenge on a docs or pricing path is a wall. A 404 is not:
 * that path simply does not exist, which is a different thing and not this
 * check's business.
 */
function noWallOnDocsCheck(input: DocumentCheckInput): CheckResult {
  const interesting = input.pages.filter((page) =>
    /\/(docs|documentation|api|developers?|reference|pricing)\b/i.test(page.url),
  );

  const walled = interesting
    .filter((page) => {
      if (page.status === 401 || page.status === 403) return true;
      if (page.headers['cf-mitigated']) return true;
      return false;
    })
    .map((page) => ({
      url: page.url,
      status: page.status,
      cf_mitigated: page.headers['cf-mitigated'] ?? '',
    }));

  const observed = {
    walled_paths: walled,
    paths_checked: interesting.map((p) => ({ url: p.url, status: p.status })),
  };

  if (interesting.length === 0) {
    return { key: 'no_wall_on_docs', status: 'skip', observed, durationMs: 0 };
  }
  return {
    key: 'no_wall_on_docs',
    status: walled.length > 0 ? 'fail' : 'pass',
    observed,
    durationMs: 0,
  };
}

/** The Accept: text/markdown probe. One request, against the target. */
export async function probeContentNegotiation(targetUrl: string): Promise<FetchOutcome | null> {
  try {
    return await guardedFetch(targetUrl, {
      headers: { accept: 'text/markdown, text/x-markdown;q=0.9, */*;q=0.1' },
    });
  } catch {
    return null;
  }
}

/** The opening of a readable text, whitespace-collapsed, cut on a word. */
function excerpt(text: string, max = 320): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trimEnd()}…`;
}
