/**
 * The fix pack. Deterministic templates, driven entirely by what the scan
 * observed.
 *
 * The rule that makes this worth paying for is also the rule that makes it
 * safe: no model touches a fact. Every URL, title, price, agent name and header
 * value in a generated file came out of the evidence rows. The only model call
 * in the entire product is the prose framing on the punch list, and it is handed
 * the facts as text it may reorder and not as values it may invent.
 *
 * The diagnosis is free and fully visible. This is the paid artifact, and the
 * paywall shows a real generated file cut off part way through rather than a
 * blurred one, because a blurred score is annoying and a real file cut off four
 * lines in is a demonstration.
 */

import type { CheckResult, ObservedPage, SitemapObserved } from '../types';

import { buildLlmsTxt } from './llms-txt';
import { buildRobotsBlock } from './robots-txt';
import { buildMarkdownAlternates } from './markdown-alternate';
import { buildJsonLd } from './jsonld';
import { buildWafRule } from './waf-rule';
import { buildAgentPrompt } from './agent-prompt';
import { buildPunchList, type PunchItem } from './punchlist';

export { punchListMarkdown, type Effort, type PunchItem } from './punchlist';
export { buildAnswerPack } from './answer-pack';
export { brandFrom, oneLine, pathOf } from './shared';

export interface FixFile {
  /** The filename we suggest, used as the download name. */
  name: string;
  /** What a reader does with it, in one line. */
  purpose: string;
  language: 'markdown' | 'text' | 'html' | 'json';
  content: string;
  /** The check keys that made this file necessary. */
  addresses: string[];
  /**
   * True when the scan did not observe enough to generate anything useful. The
   * file is still included, with a note saying what is missing, because a fix
   * pack that silently drops a file is worse than one that explains a gap.
   */
  incomplete: boolean;
}

export interface FixPack {
  domain: string;
  files: FixFile[];
  punchList: PunchItem[];
  /**
   * botready-fixes.md: the full prompt for a coding agent, built from the
   * files and the punch list. Shipped in the zip beside them.
   */
  agentPrompt: string;
}

/**
 * The whole pack, from a scan's evidence. Pure: same evidence, same files,
 * forever, which is what makes the paywall preview and the download identical.
 */
export function buildFixPack(domain: string, results: CheckResult[]): FixPack {
  const facts = readFacts(results);

  const files: FixFile[] = [
    buildLlmsTxt(domain, facts),
    buildRobotsBlock(domain, facts),
    buildWafRule(domain, facts),
    buildMarkdownAlternates(domain, facts),
    buildJsonLd(domain, facts),
  ];

  const pack: FixPack = { domain, files, punchList: buildPunchList(results), agentPrompt: '' };
  pack.agentPrompt = buildAgentPrompt(pack);
  return pack;
}

export { buildAgentPrompt } from './agent-prompt';

/**
 * Everything the generators read, pulled out of `observed` once and typed, so
 * that a generator cannot reach for a fact the scan did not record.
 */
export interface ScanFacts {
  /** Pages the scan fetched and saw return 2xx, with their real titles. */
  pages: ObservedPage[];
  sitemap: SitemapObserved;
  /** Agent ids the site's robots.txt disallows. */
  refusedByRobots: string[];
  /** Agent ids the site's edge answered with a 4xx or 5xx. */
  refusedByEdge: Array<{ id: string; status: number; server: string; cfMitigated: string }>;
  /** Whether search crawlers were let through while agents were not. */
  searchCrawlersAllowed: boolean;
  jsonLdTypes: string[];
  offerNodes: number;
  canonical: string;
  ogMissing: string[];
  /** The target page's own title and description. */
  siteTitle: string;
  siteDescription: string;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
}

export function readFacts(results: CheckResult[]): ScanFacts {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const observed = (key: string): Record<string, unknown> => byKey.get(key)?.observed ?? {};

  const titles = observed('title_meta_distinct');
  const rawPages = Array.isArray(titles.pages) ? (titles.pages as ObservedPage[]) : [];
  // Only what we saw work. A generated file that names a 404 is worse than no
  // generated file, because it moves the reader's effort rather than failing.
  const pages = rawPages.filter(
    (page) => page && typeof page.url === 'string' && page.status >= 200 && page.status < 300,
  );

  const sitemapObserved = observed('sitemap_present');
  const lastmodObserved = observed('sitemap_lastmod_real');
  void lastmodObserved;

  const robotsRules = observed('robots_agent_rules');
  const perAgentRobots = (robotsRules.per_agent ?? {}) as Record<
    string,
    { allowed: boolean; matched_rule: string }
  >;

  const parity = observed('agent_status_parity');
  const perAgentEdge = (parity.per_agent ?? {}) as Record<
    string,
    { status: number; server?: string; cf_mitigated?: string }
  >;
  const controlId = String(parity.control ?? 'chrome');

  const structure = observed('jsonld_present');
  const pricing = observed('pricing_structured');
  const canonicalOg = observed('canonical_og');

  const target = pages[0];

  return {
    pages,
    sitemap: {
      status: Number(sitemapObserved.status ?? 0),
      url_count: Number(sitemapObserved.url_count ?? 0),
      has_lastmod: Boolean(sitemapObserved.has_lastmod),
      urls: Array.isArray(sitemapObserved.urls)
        ? (sitemapObserved.urls as SitemapObserved['urls'])
        : [],
    },
    refusedByRobots: Object.entries(perAgentRobots)
      .filter(([id, v]) => id !== controlId && v.allowed === false)
      .map(([id]) => id),
    refusedByEdge: Object.entries(perAgentEdge)
      .filter(([id, v]) => id !== controlId && v.status >= 400)
      .map(([id, v]) => ({
        id,
        status: v.status,
        server: v.server ?? '',
        cfMitigated: v.cf_mitigated ?? '',
      })),
    searchCrawlersAllowed: robotsRules.search_crawlers_allowed !== false,
    jsonLdTypes: Array.isArray(structure.types) ? (structure.types as string[]) : [],
    offerNodes: Number(pricing.offer_nodes ?? 0),
    canonical: String(canonicalOg.canonical ?? ''),
    ogMissing: Array.isArray(canonicalOg.og_missing) ? (canonicalOg.og_missing as string[]) : [],
    siteTitle: target?.title ?? '',
    siteDescription: target?.description ?? '',
    hasLlmsTxt: byKey.get('llms_txt_present')?.status === 'pass',
    hasSitemap: byKey.get('sitemap_present')?.status === 'pass',
  };
}

/**
 * The paywall preview: a real file, cut off part way through.
 *
 * Never blurred, never a mock. The reader sees their own domain, their own page
 * titles, and the file stopping mid-thought, which is an honest way to charge
 * for something whose diagnosis is free.
 */
export function previewOf(file: FixFile, lines = 9): { text: string; truncated: boolean } {
  const all = file.content.replace(/\n+$/, '').split('\n');
  if (all.length <= lines) return { text: file.content, truncated: false };

  const shown = all.slice(0, lines);
  // Never end on a blank: it reads as the end of a short file. Back up to the
  // last line with something on it, then stop that line mid-way, so the cut
  // reads as a cut.
  while (shown.length > 1 && (shown[shown.length - 1] ?? '').trim() === '') shown.pop();
  const last = shown[shown.length - 1] ?? '';
  const keep = last.length > 24 ? Math.floor(last.length * 0.7) : last.length;
  shown[shown.length - 1] = `${last.slice(0, keep).trimEnd()} …`;

  return { text: shown.join('\n'), truncated: true };
}
