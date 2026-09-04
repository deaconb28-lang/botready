/**
 * Which part of the public index a site belongs in, from the evidence a scan
 * already recorded.
 *
 * This exists because `sites.segment` was only ever written by the seed script,
 * so a site somebody scanned from the home page could never enter the index or
 * be re-scanned by the nightly cron — while the index page promised "every site
 * we've scanned in this category". This makes that sentence true.
 *
 * It is deliberately reluctant. Returning `null` is the common and correct
 * answer, and a site with no segment stays out of the ranking rather than being
 * filed under a guess. Every rule below needs a fact from the page — a
 * schema.org type the site published about itself, or a path it links to — and
 * nothing here reads tone, industry or vibe.
 *
 * Pure, like scoring, and for the same reason: it is a judgement over recorded
 * evidence, so it belongs where it can be re-run over history and tested
 * without a database.
 */

import type { CheckResult } from './types';

export type SegmentKey = 'saas' | 'devtools' | 'ecommerce' | 'media';

export interface SegmentVerdict {
  segment: SegmentKey;
  /** The facts that decided it, for the record and for anyone arguing. */
  reasons: string[];
}

/**
 * schema.org types that only appear on one kind of site. A site publishing
 * these is describing itself, which is a stronger signal than anything we
 * could infer from its prose.
 */
const TYPES: Record<SegmentKey, string[]> = {
  media: ['NewsArticle', 'NewsMediaOrganization', 'Newspaper', 'Periodical', 'BlogPosting', 'Blog'],
  ecommerce: ['Store', 'OnlineStore', 'OnlineBusiness', 'ClothingStore', 'ShoppingCenter'],
  devtools: ['APIReference', 'SoftwareSourceCode'],
  saas: ['SoftwareApplication', 'WebApplication', 'Service'],
};

/** Paths that mean one thing. A /cart is not a marketing metaphor. */
const PATHS: Array<{ segment: SegmentKey; pattern: RegExp; reason: string }> = [
  { segment: 'ecommerce', pattern: /\/(cart|checkout|basket)(\/|$|\?)/i, reason: 'links to a cart or checkout' },
  { segment: 'ecommerce', pattern: /\/(collections|products)\//i, reason: 'links to a product collection' },
  { segment: 'devtools', pattern: /\/(api|reference|sdk)(\/|$)/i, reason: 'links to an API reference' },
  { segment: 'media', pattern: /\/\d{4}\/\d{2}\//, reason: 'links to a dated article path' },
];

/** Words that only a site selling to developers puts in its own title. */
const DEVELOPER_WORDS = /\b(api|sdk|cli|developers?|open.?source|self.?host|npm|docker|kubernetes|webhook|library|framework|runtime|compiler|deploy)\b/i;

export function classifySegment(results: CheckResult[]): SegmentVerdict | null {
  const by = new Map(results.map((r) => [r.key, r]));
  const reasons = new Map<SegmentKey, string[]>();
  const note = (segment: SegmentKey, reason: string) => {
    const list = reasons.get(segment) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(segment, list);
  };

  // ------------------------------------------------------- what it says it is
  const jsonLd = by.get('jsonld_present');
  const declared = asStrings(jsonLd?.observed.types).concat(asStrings(jsonLd?.observed.types_in_raw_html));
  for (const [segment, types] of Object.entries(TYPES) as Array<[SegmentKey, string[]]>) {
    for (const type of types) {
      if (declared.includes(type)) note(segment, `publishes schema.org ${type}`);
    }
  }

  // ------------------------------------------------------- where it links to
  const urls = crawledUrls(by);
  for (const { segment, pattern, reason } of PATHS) {
    if (urls.some((url) => pattern.test(path(url)))) note(segment, reason);
  }

  const docs = by.get('api_docs_reachable');
  if (docs?.status === 'pass' && typeof docs.observed.url === 'string') {
    // Docs alone are not a dev tool — most SaaS has them — so this only counts
    // beside developer vocabulary in the site's own title.
    if (DEVELOPER_WORDS.test(titleAndDescription(by))) {
      note('devtools', 'reachable API docs and developer wording in the title');
    }
  }

  // ------------------------------------------------------- what it sells
  const pricing = by.get('pricing_structured');
  const offers = Number(pricing?.observed.offer_nodes ?? 0);
  if (offers > 0 && !reasons.has('ecommerce')) {
    // Priced offers with no cart anywhere is what a subscription product looks
    // like. With a cart it is a shop, and the cart rule above already said so.
    note('saas', 'publishes priced offers with no cart');
  }

  // ------------------------------------------------------- decide, or do not
  //
  // Most specific first. `devtools` outranks `saas` because a developer tool is
  // a kind of SaaS and the narrower answer is the more useful one; `ecommerce`
  // and `media` outrank both because their evidence is the least ambiguous.
  for (const segment of ['ecommerce', 'media', 'devtools', 'saas'] as const) {
    const found = reasons.get(segment);
    if (found && found.length > 0) return { segment, reasons: found };
  }
  return null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Every URL the scan actually opened, target included. */
function crawledUrls(by: Map<string, CheckResult>): string[] {
  const pages = by.get('title_meta_distinct')?.observed.pages;
  if (!Array.isArray(pages)) return [];
  return pages
    .map((p) => (p && typeof p === 'object' ? (p as { url?: unknown }).url : null))
    .filter((u): u is string => typeof u === 'string');
}

function path(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** The target page's own title and description, which is where a site says what it is. */
function titleAndDescription(by: Map<string, CheckResult>): string {
  const pages = by.get('title_meta_distinct')?.observed.pages;
  if (!Array.isArray(pages) || pages.length === 0) return '';
  const first = pages[0] as { title?: unknown; description?: unknown };
  return [first?.title, first?.description].filter((v) => typeof v === 'string').join(' ');
}
