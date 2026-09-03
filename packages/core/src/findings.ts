/**
 * Findings: an observation turned into a sentence.
 *
 * This is the one place in the product where facts become prose, and it is a
 * pure function of the facts so that the same evidence always produces the same
 * sentence. No model call, no template that could be filled with a number the
 * scan did not measure.
 *
 * Every headline states what was measured, in the units it was measured in.
 * "97% of your page text needs JavaScript" is a finding. "Your site has poor
 * AI readiness" is a horoscope.
 */

import { catalogFor, checkDef } from './catalog';
import { pointsLost } from './scoring';
import type { CategoryKey, CheckResult, CheckStatus } from './types';

export interface Finding {
  key: string;
  /** The catalog's label for the check. */
  label: string;
  status: CheckStatus;
  category: CategoryKey;
  /** Points this cost the total, by the same arithmetic that produced it. */
  pointsLost: number;
  /** One sentence naming what we measured. */
  headline: string;
  /** Two or three sentences of what it means and what to do. */
  body: string;
  /** The raw request, response or count, printed as it happened. */
  evidence: string;
  /** Key into the remedy generators, when there is a file we can produce. */
  remedy?: string;
}

/**
 * Everything that did not pass, worst first. A `skip` is not a finding: there
 * was nothing to measure, and saying so on the page would read as a complaint.
 */
export function findings(results: CheckResult[], version?: string): Finding[] {
  const catalog = catalogFor(version);
  const byKey = new Map(results.map((r) => [r.key, r]));
  const out: Finding[] = [];

  for (const def of catalog.checks) {
    const result = byKey.get(def.key);
    if (!result) continue;
    if (result.status === 'pass' || result.status === 'skip') continue;

    const written = describe(def.key, result, results);
    out.push({
      key: def.key,
      label: def.label,
      status: result.status,
      category: def.category,
      pointsLost: pointsLost(results, def.key, version),
      headline: written.headline,
      body: written.body,
      evidence: written.evidence,
      ...(def.remedy ? { remedy: def.remedy } : {}),
    });
  }

  // Worst first, and a tie broken by catalog order so the list is stable
  // between two reads of the same evidence.
  return out.sort((a, b) => b.pointsLost - a.pointsLost);
}

/** The passes, for the "what already works" list. */
export function passing(results: CheckResult[], version?: string): Finding[] {
  const catalog = catalogFor(version);
  const byKey = new Map(results.map((r) => [r.key, r]));

  return catalog.checks
    .filter((def) => byKey.get(def.key)?.status === 'pass')
    .map((def) => {
      const result = byKey.get(def.key);
      if (!result) throw new Error('unreachable');
      const written = describe(def.key, result, results);
      return {
        key: def.key,
        label: def.label,
        status: 'pass' as const,
        category: def.category,
        pointsLost: 0,
        headline: written.headline,
        body: written.body,
        evidence: written.evidence,
      };
    });
}

// ------------------------------------------------------------------ the writing

interface Written {
  headline: string;
  body: string;
  evidence: string;
}

function describe(key: string, result: CheckResult, all: CheckResult[]): Written {
  const o = result.observed;
  const failed = result.status === 'fail';

  if (result.status === 'error') {
    // The check could not run. Say that, rather than implying the site failed
    // something we never measured.
    const label = checkDef(key)?.label ?? key;
    return {
      headline: `We could not measure this: ${lower(label)}`,
      body: 'The check errored rather than failing. Nothing on your site is implied by it. Run the scan again, and if it keeps erroring the problem is ours.',
      evidence: printFacts(o),
    };
  }

  switch (key) {
    case 'agent_status_parity':
      return parity(o, failed);
    case 'js_dependency_ratio':
      return jsRatio(o);
    case 'raw_fetch_latency':
      return latency(o, failed);
    case 'redirect_depth':
      return redirects(o, failed);
    case 'robots_present':
      return robotsPresent(o, failed);
    case 'robots_agent_rules':
      return robotsRules(o, failed);
    case 'sitemap_present':
      return sitemap(o);
    case 'llms_txt_present':
      return llmsTxt(o, failed);
    case 'markdown_alternate':
      return markdown(o, failed);
    case 'semantic_landmarks':
      return landmarks(o);
    case 'title_meta_distinct':
      return titles(o);
    case 'content_negotiation':
      return negotiation(o);
    case 'jsonld_present':
      return jsonLd(o, failed);
    case 'pricing_structured':
      return pricing(o, failed);
    case 'canonical_og':
      return canonical(o);
    case 'agent_manifest':
      return manifest(o);
    case 'api_docs_reachable':
      return apiDocs(o);
    case 'form_semantics':
      return forms(o, failed);
    case 'no_wall_on_docs':
      return wall(o);
    case 'cache_headers':
      return cache(o, failed);
    case 'sitemap_lastmod_real':
      return lastmod(o, all);
    default:
      return {
        headline: checkDef(key)?.label ?? key,
        body: '',
        evidence: printFacts(o),
      };
  }
}

// ------------------------------------------------------------------ retrievability

function parity(o: Record<string, unknown>, failed: boolean): Written {
  const perAgent = (o.per_agent ?? {}) as Record<string, AgentFact>;
  const control = String(o.control ?? 'chrome');
  const controlStatus = perAgent[control]?.status ?? 0;

  const disagreeing = Object.entries(perAgent).filter(
    ([id, fact]) => id !== control && klass(fact.status) !== klass(controlStatus),
  );

  const names = disagreeing.map(([id]) => id);
  const refused = disagreeing.filter(([, f]) => f.status >= 400);
  const mitigated = disagreeing.find(([, f]) => f.cf_mitigated)?.[1];
  const server = Object.values(perAgent).find((f) => f.server)?.server ?? '';

  const headline = failed
    ? `${capitalise(count(disagreeing.length))} agent ${plural(disagreeing.length, 'client')} ${
        disagreeing.length === 1 ? 'is' : 'are'
      } refused at the edge`
    : `Your page answers ${controlStatus} to a browser, and the agents do not all get the same`;

  const body = refused.length
    ? `Your edge answers ${list(names)} with ${list(
        [...new Set(refused.map(([, f]) => String(f.status)))],
      )} while answering the ${control} control with ${controlStatus}, from the same address in the same few seconds.${
        mitigated
          ? ` The ${server || 'edge'} response carries cf-mitigated: ${mitigated}, which means a bot-protection rule intercepted the request rather than your application answering it.`
          : ' Nothing in your robots.txt asks for this, so it is almost certainly a bot-protection rule rather than a decision.'
      }`
    : `${list(names)} received a different status class from the ${control} control. Same URL, same second, different answer.`;

  const lines: string[] = [];
  for (const [id, fact] of Object.entries(perAgent)) {
    lines.push(`${id.padEnd(12)} HTTP ${fact.status || '---'}${fact.transport_error ? `  ${fact.transport_error}` : ''}`);
    if (fact.server) lines.push(`${''.padEnd(12)}   server: ${fact.server}`);
    if (fact.cf_mitigated) lines.push(`${''.padEnd(12)}   cf-mitigated: ${fact.cf_mitigated}`);
  }

  return { headline, body, evidence: lines.join('\n') };
}

interface AgentFact {
  status: number;
  server?: string;
  cf_mitigated?: string;
  bytes?: number;
  transport_error?: string;
}

function jsRatio(o: Record<string, unknown>): Written {
  const raw = num(o.raw_chars);
  const rendered = num(o.rendered_chars);
  const ratio = num(o.ratio);
  const percent = Math.round(ratio * 100);

  return {
    headline: `${percent}% of your page text needs JavaScript`,
    body: `A plain fetch returns ${fmt(raw)} readable ${plural(
      raw,
      'character',
    )}. After rendering, the same page has ${fmt(rendered)}. Any client that does not run a browser sees ${
      raw < 400 ? 'an almost empty document' : 'a fraction of the page'
    }, and that includes most of what reads your site to answer a question about it.`,
    evidence: [
      `raw fetch    ${fmt(raw).padStart(8)} chars   ${bar(raw, Math.max(raw, rendered))}`,
      `rendered     ${fmt(rendered).padStart(8)} chars   ${bar(rendered, Math.max(raw, rendered))}`,
      `JS dependency ratio: ${ratio.toFixed(2)}`,
    ].join('\n'),
  };
}

function latency(o: Record<string, unknown>, failed: boolean): Written {
  const ttfb = num(o.ttfb_ms);
  const bytes = num(o.bytes);
  return {
    headline: `First byte took ${fmt(ttfb)} ms`,
    body: failed
      ? `An agent working through a list of sources gives each one a budget. ${fmt(
          ttfb,
        )} ms to the first byte spends most of it before any text has arrived.`
      : `Not slow enough to be a problem, but ${fmt(ttfb)} ms is measurably behind a page that answers in under 300.`,
    evidence: `ttfb  ${fmt(ttfb)} ms\ntotal ${fmt(num(o.total_ms))} ms\nbytes ${fmt(bytes)}`,
  };
}

function redirects(o: Record<string, unknown>, failed: boolean): Written {
  const hops = num(o.hops);
  const chain = (o.chain ?? []) as Array<{ from: string; to: string; status: number }>;
  return {
    headline: `${capitalise(count(hops))} ${plural(hops, 'redirect')} before the page arrives`,
    body: failed
      ? 'Each hop is a round trip an agent pays for before it reads a word, and some clients stop following after a handful. Collapse the chain to one hop.'
      : 'Two hops is not fatal, but it is two round trips before any text arrives, and it is usually one canonical rule stacked on another.',
    evidence: chain.map((hop) => `${hop.status}  ${hop.from}\n   → ${hop.to}`).join('\n') || 'no chain recorded',
  };
}

// ------------------------------------------------------------------ discovery

function robotsPresent(o: Record<string, unknown>, failed: boolean): Written {
  const status = num(o.status);
  const errors = (o.parse_errors ?? []) as string[];

  if (failed) {
    return {
      headline: `No robots.txt at the root`,
      body: 'Without one, every crawler applies its own default, and you have no way to say anything to any of them. A robots.txt that allows everything is still better than none, because it is the file agents look for first.',
      evidence: `GET /robots.txt → ${status || 'no reply'}`,
    };
  }
  if (errors.length > 0) {
    return {
      headline: `Your robots.txt has ${count(errors.length)} ${plural(errors.length, 'line')} nothing can parse`,
      body: 'A parser that hits a line it cannot read either skips it or stops. Either way the rules after it are not doing what you think.',
      evidence: errors.join('\n'),
    };
  }
  return {
    headline: 'Your robots.txt is served but says nothing',
    body: 'The file exists and parses, and contains no directives. That is the same as having no file, except that agents will keep asking for it.',
    evidence: `GET /robots.txt → ${status}, ${num(o.bytes)} bytes, no directives`,
  };
}

function robotsRules(o: Record<string, unknown>, failed: boolean): Written {
  const perAgent = (o.per_agent ?? {}) as Record<string, { allowed: boolean; matched_rule: string }>;
  const refused = Object.entries(perAgent).filter(([, v]) => !v.allowed);
  const searchAllowed = o.search_crawlers_allowed === true;

  const headline = failed
    ? `robots.txt blocks ${count(refused.length)} reading ${plural(refused.length, 'agent')} and lets search crawlers through`
    : `robots.txt blocks every crawler, agents and search alike`;

  const body = failed
    ? `${list(refused.map(([id]) => id))} ${
        refused.length === 1 ? 'is' : 'are'
      } disallowed while Googlebot and Bingbot are not. Almost nobody decides that on purpose: it is the shape you get from pasting a blocklist off a forum. If you meant it, keep it. If you did not, these are the lines to change.`
    : 'Everything is disallowed, search crawlers included. That is a decision rather than an accident, so it is recorded as one and costs less than the split above would.';

  const lines = Object.entries(perAgent).map(
    ([id, v]) => `${id.padEnd(12)} ${v.allowed ? 'allowed' : 'DISALLOWED'}${v.matched_rule ? `   ${v.matched_rule}` : ''}`,
  );
  lines.push('', `search crawlers allowed: ${searchAllowed}`);

  return { headline, body, evidence: lines.join('\n') };
}

function sitemap(o: Record<string, unknown>): Written {
  const status = num(o.status);
  const count_ = num(o.url_count);
  return {
    headline: count_ === 0 && status >= 200 && status < 300 ? 'Your sitemap is empty' : 'No sitemap we could read',
    body: 'A sitemap is how an agent finds the pages you did not link from the homepage. Without one it reads what it can reach in a couple of hops and stops, which on most sites misses the documentation entirely.',
    evidence: `GET /sitemap.xml → ${status || 'no reply'}\n${count_} URLs`,
  };
}

function llmsTxt(o: Record<string, unknown>, failed: boolean): Written {
  const status = num(o.status);
  const links = num(o.link_count);
  const broken = (o.broken_links ?? []) as string[];

  if (failed) {
    return {
      headline: 'No llms.txt at the root',
      body: 'Nothing tells a reading agent which of your URLs matter. Your sitemap lists them all with equal weight, so a summariser picks whichever it hits first, and on most sites that is a blog post from two years ago.',
      evidence: `GET /llms.txt → ${status || 'no reply'}${o.served_html ? '\n(the path answered with HTML, not a markdown file)' : ''}`,
    };
  }
  if (broken.length > 0) {
    return {
      headline: `${capitalise(count(broken.length))} of the links in your llms.txt ${plural(broken.length, 'is', 'are')} dead`,
      body: 'An agent that trusts the file spends its budget on the dead ends. A file with broken links in it is worse than no file, because it redirects effort rather than merely failing to direct it.',
      evidence: broken.map((href) => `dead  ${href}`).join('\n'),
    };
  }
  return {
    headline: 'Your llms.txt has no links in it',
    body: `The file is served and has ${links} followable ${plural(links, 'link')}. The point of it is to name the pages that matter, so a file without links is a heading with nothing under it.`,
    evidence: `GET /llms.txt → ${status}\n${links} links found`,
  };
}

// ------------------------------------------------------------------ representation

function markdown(o: Record<string, unknown>, failed: boolean): Written {
  if (!failed && o.link_tag_after_render) {
    return {
      headline: 'Your markdown alternate is advertised only after JavaScript runs',
      body: 'The link tag is in the rendered DOM and not in the response your server sent. A client that does not run a browser never sees it, which is exactly the client the tag is for.',
      evidence: 'link rel=alternate type=text/markdown\n  in raw HTML:      no\n  after rendering:  yes',
    };
  }
  return {
    headline: 'No markdown representation is advertised',
    body: 'There is no link rel=alternate type=text/markdown, no Link header saying the same thing, and the server does not change its answer for Accept: text/markdown. An agent that would rather read 4 KB of markdown than 400 KB of HTML has no way to ask.',
    evidence: [
      'link rel=alternate type=text/markdown   absent',
      `Link: header advertising markdown        ${o.link_header ? 'present' : 'absent'}`,
      `Accept: text/markdown honoured           ${o.accept_negotiation ? 'yes' : 'no'}`,
    ].join('\n'),
  };
}

function landmarks(o: Record<string, unknown>): Written {
  const h1 = num(o.h1_count);
  const breaks = num(o.heading_order_breaks);
  const problems: string[] = [];
  if (h1 !== 1) problems.push(h1 === 0 ? 'no h1' : `${h1} h1 elements`);
  if (!o.has_main) problems.push('no main landmark');
  if (breaks > 0) problems.push(`${breaks} ${plural(breaks, 'skipped heading level')}`);

  return {
    headline: problems.length ? `Your page has ${list(problems)}` : 'The heading structure is not clean',
    body: 'A reading agent uses the heading tree to decide what a page is about and which part answers the question it was given. When the tree is broken it falls back to reading the whole document, which costs it more and gets you a worse summary.',
    evidence: [
      `h1 elements            ${h1}`,
      `main landmark          ${o.has_main ? 'present' : 'absent'}`,
      `headings               ${num(o.headings)}`,
      `skipped heading levels ${breaks}`,
      `headings with an id    ${num(o.heading_ids)}`,
      `read from              ${String(o.read_from ?? 'rendered_dom')}`,
    ].join('\n'),
  };
}

function titles(o: Record<string, unknown>): Written {
  const pages = (o.pages ?? []) as Array<{ url: string; title: string; description: string }>;
  const duplicateTitles = num(o.duplicate_titles);
  const missing = num(o.missing_title_or_description);

  const headline = duplicateTitles > 0
    ? `${capitalise(count(duplicateTitles + 1))} of your pages share a title`
    : missing > 0
      ? `${capitalise(count(missing))} of the pages we read ${plural(missing, 'is', 'are')} missing a title or a description`
      : 'Your titles and descriptions are not distinct per page';

  return {
    headline,
    body: 'The title and the description are the two lines an agent quotes when it cites you. When they are the same on every page, every citation points at your site rather than at the page that answered the question.',
    evidence: pages
      .map((p) => `${p.url}\n  title: ${p.title || '(none)'}\n  desc:  ${p.description || '(none)'}`)
      .join('\n'),
  };
}

function negotiation(o: Record<string, unknown>): Written {
  return {
    headline: 'Your server ignores Accept: text/markdown',
    body: 'We asked for markdown and got HTML back. Almost every server does this, which is why it is worth three points rather than thirty, but honouring it is the cheapest way to hand an agent a tenth of the bytes.',
    evidence: `Accept: text/markdown\n→ ${num(o.status)} ${String(o.content_type || 'no content type')}`,
  };
}

// ------------------------------------------------------------------ structure

function jsonLd(o: Record<string, unknown>, failed: boolean): Written {
  const types = (o.types ?? []) as string[];
  const errors = (o.errors ?? []) as string[];

  if (failed) {
    return {
      headline: 'No JSON-LD anywhere on the page',
      body: 'Nothing on the page says what kind of thing it is in a form a machine reads without guessing. An Organization block and a Product block are twenty lines and they remove the guessing.',
      evidence: 'script type="application/ld+json"   none found',
    };
  }
  if (errors.length > 0) {
    return {
      headline: `Your JSON-LD does not parse`,
      body: 'The block is there and a parser rejects it, which means it is doing nothing at all. A trailing comma is the usual cause.',
      evidence: errors.join('\n'),
    };
  }
  return {
    headline: `Your JSON-LD describes the page, not the product`,
    body: `The only types present are ${list(types)}, which say this is a web page on a web site. That is true of every URL. What is missing is the block that says what you sell, who you are, or what this document is.`,
    evidence: `@type values found: ${types.join(', ') || 'none'}`,
  };
}

function pricing(o: Record<string, unknown>, failed: boolean): Written {
  const inRaw = num(o.prices_in_raw_html);
  const afterRender = num(o.prices_after_render);

  if (failed) {
    return {
      headline: 'Your prices only exist after JavaScript runs',
      body: `We found ${afterRender} ${plural(
        afterRender,
        'price',
      )} in the rendered page and none in the response your server sent. "What does this cost" is the single most common question asked about a company, and right now the answer is not in your HTML.`,
      evidence: [
        `Offer nodes in JSON-LD    ${num(o.offer_nodes)}`,
        `prices in the raw HTML    ${inRaw}`,
        `prices after rendering    ${afterRender}`,
        `read from                 ${String(o.read_from ?? '')}`,
      ].join('\n'),
    };
  }
  return {
    headline: 'Your prices are text, not structured data',
    body: `There ${inRaw === 1 ? 'is' : 'are'} ${inRaw} ${plural(
      inRaw,
      'price',
    )} readable on the page and no Offer node describing any of them. A machine has to guess which number is the price and what it buys, and it will sometimes guess the crossed-out one.`,
    evidence: [
      `Offer nodes in JSON-LD    ${num(o.offer_nodes)}`,
      `prices in the raw HTML    ${inRaw}`,
      `read from                 ${String(o.read_from ?? '')}`,
    ].join('\n'),
  };
}

function canonical(o: Record<string, unknown>): Written {
  const missing = (o.og_missing ?? []) as string[];
  const canonicalUrl = String(o.canonical ?? '');
  const parts: string[] = [];
  if (!canonicalUrl) parts.push('no canonical URL');
  if (missing.length) parts.push(`${missing.length} OpenGraph ${plural(missing.length, 'tag')} missing`);

  return {
    headline: parts.length ? `Your page has ${list(parts)}` : 'Canonical and OpenGraph are incomplete',
    body: 'Without a canonical, every parameterised version of this URL is a separate page as far as anything reading you is concerned. The OpenGraph tags are what gets quoted when someone shares you, including when the sharer is a model.',
    evidence: [
      `canonical    ${canonicalUrl || '(absent)'}`,
      `og missing   ${missing.join(', ') || 'none'}`,
    ].join('\n'),
  };
}

// ------------------------------------------------------------------ actionability

function manifest(o: Record<string, unknown>): Written {
  const probed = (o.probed ?? []) as Array<{ path: string; status: number }>;
  return {
    headline: 'No agent manifest under /.well-known',
    body: 'Nothing declares what an agent can do here beyond reading. This is the newest and least settled of the conventions we check, which is why it is worth five points, but it is also the only one that describes actions rather than text.',
    evidence: probed.map((p) => `GET ${p.path} → ${p.status || 'no reply'}`).join('\n'),
  };
}

function apiDocs(o: Record<string, unknown>): Written {
  return {
    headline: 'Your API docs are not reachable from the homepage in two hops',
    body: `We read the homepage and ${num(
      o.pages_searched,
    ) - 1} pages linked from it and found nothing that looks like API documentation. If it exists, the path to it is longer than an agent will walk.`,
    evidence: `pages searched  ${num(o.pages_searched)}\nfound           nothing matching /api, /docs or /reference`,
  };
}

function forms(o: Record<string, unknown>, failed: boolean): Written {
  const list_ = (o.forms ?? []) as Array<{
    action: string;
    fields: number;
    labelled: number;
    named: number;
    with_autocomplete: number;
  }>;
  const fields = list_.reduce((s, f) => s + f.fields, 0);
  const labelled = list_.reduce((s, f) => s + f.labelled, 0);
  const autocomplete = list_.reduce((s, f) => s + f.with_autocomplete, 0);

  return {
    headline: failed
      ? `${capitalise(count(fields - labelled))} of ${fields} form ${plural(fields, 'field')} ${
          fields - labelled === 1 ? 'has' : 'have'
        } no label`
      : `Your forms are missing autocomplete tokens on ${count(fields - autocomplete)} of ${fields} ${plural(fields, 'field')}`,
    body: 'An agent filling in a form reads the label to know what a field wants and the autocomplete token to know what to put there. A placeholder is not a label, and a field named "field_3" tells it nothing.',
    evidence: list_
      .map(
        (f) =>
          `form action="${f.action || '(none)'}"\n  fields ${f.fields}  labelled ${f.labelled}  named ${f.named}  autocomplete ${f.with_autocomplete}`,
      )
      .join('\n'),
  };
}

function wall(o: Record<string, unknown>): Written {
  const walled = (o.walled_paths ?? []) as Array<{ url: string; status: number; cf_mitigated: string }>;
  return {
    headline: `${capitalise(count(walled.length))} documentation or pricing ${plural(walled.length, 'path')} sits behind a wall`,
    body: 'A path that answers 401, 403 or a challenge cannot be read by anything that is not logged in. Documentation and pricing behind a wall are invisible to every answer written about you.',
    evidence: walled
      .map((p) => `${p.status}  ${p.url}${p.cf_mitigated ? `   cf-mitigated: ${p.cf_mitigated}` : ''}`)
      .join('\n'),
  };
}

// ------------------------------------------------------------------ freshness

function cache(o: Record<string, unknown>, failed: boolean): Written {
  void failed;
  return {
    headline: 'Your page sends neither Last-Modified nor ETag',
    body: 'Anything that reads you regularly has to fetch the whole page every time to find out whether it changed. One header turns that into a conditional request that usually costs nothing.',
    evidence: `last-modified  ${String(o.last_modified || '(absent)')}\netag           ${String(o.etag || '(absent)')}`,
  };
}

function lastmod(o: Record<string, unknown>, all: CheckResult[]): Written {
  const distinct = num(o.distinct_dates);
  const future = num(o.future_dates);
  const withLastmod = num(o.urls_with_lastmod);
  const seen = num(o.urls_seen);
  const sitemapCount = num(
    (all.find((r) => r.key === 'sitemap_present')?.observed.url_count as number) ?? seen,
  );

  const headline =
    future > 0
      ? `${capitalise(count(future))} sitemap ${plural(future, 'lastmod value')} ${future === 1 ? 'is' : 'are'} in the future`
      : withLastmod === 0
        ? 'Your sitemap has no lastmod values at all'
        : `All ${fmt(withLastmod)} sitemap entries share one lastmod date`;

  return {
    headline,
    body:
      future > 0
        ? 'A date in the future is not a date. Whatever generates the sitemap is stamping something other than when the page changed.'
        : withLastmod === 0
          ? `Your sitemap lists ${fmt(sitemapCount)} URLs with no indication of when any of them last changed, so anything re-reading you has to re-read all of it.`
          : 'One date across every URL means the generator stamped the build rather than the change. It carries no information, which is worse than leaving the field out, because it looks like information.',
    evidence: [
      `URLs seen              ${fmt(seen)}`,
      `URLs with a lastmod    ${fmt(withLastmod)}`,
      `distinct dates         ${distinct}`,
      `dates in the future    ${future}`,
    ].join('\n'),
  };
}

// ------------------------------------------------------------------ words

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * Small numbers as words, because a headline reads better that way. Lowercase:
 * these appear mid-sentence more often than at the start, and "on Three of 4
 * fields" is worse than either alternative. Headlines that open with one wrap
 * it in `capitalise`.
 */
function count(n: number): string {
  return n >= 0 && n < WORDS.length ? (WORDS[n] ?? String(n)) : fmt(n);
}

/** Sentence case, applied at the start of a headline and nowhere else. */
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, singular: string, pluralForm?: string): string {
  if (n === 1) return singular;
  return pluralForm ?? `${singular}s`;
}

function list(items: string[]): string {
  if (items.length === 0) return 'nothing';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function klass(status: number): string {
  if (!status) return 'none';
  return `${Math.floor(status / 100)}xx`;
}

/** A twenty-cell bar, for the two counts in the JS ratio evidence block. */
function bar(value: number, peak: number): string {
  if (peak <= 0) return '';
  const filled = Math.max(value > 0 ? 1 : 0, Math.round((value / peak) * 20));
  return '█'.repeat(filled);
}

/** Fallback evidence: whatever facts we have, printed as key and value. */
function printFacts(observed: Record<string, unknown>): string {
  return Object.entries(observed)
    .map(([key, value]) => `${key.padEnd(24)} ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join('\n');
}
