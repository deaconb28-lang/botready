/**
 * Readable-text extraction and DOM facts.
 *
 * The JS dependency ratio is the highest-weighted single check in the catalog,
 * so the one thing that must be true here is that both sides of the comparison
 * go through the identical code path. The rendered side arrives as serialised
 * HTML from Playwright rather than as a live page, precisely so that it can be
 * parsed and extracted by the same jsdom and the same Readability as the raw
 * side. If the two sides used different extractors, the ratio would measure the
 * difference between two algorithms as much as the difference between two
 * documents.
 */

import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * jsdom runs no scripts here, and this is not a default we are relying on: a
 * raw-HTML side that executed script would defeat the entire measurement, and a
 * scanner that executes arbitrary script outside the browser sandbox is a
 * liability. Scripts run in exactly one place in this worker, which is Chromium.
 */
function parse(html: string, url: string): JSDOM {
  const virtualConsole = new VirtualConsole();
  // Sites log to console. That is not our error, and it is not our output.
  virtualConsole.on('jsdomError', () => {});
  virtualConsole.on('error', () => {});
  virtualConsole.on('warn', () => {});

  return new JSDOM(html, {
    url,
    contentType: 'text/html',
    runScripts: undefined, // never
    pretendToBeVisual: false,
    virtualConsole,
  });
}

export interface Readable {
  /** Characters of readable prose, whitespace-collapsed. */
  chars: number;
  /** The extracted text, kept only long enough to build llms.txt descriptions. */
  text: string;
  title: string;
  /** True when Readability declined to find an article at all. */
  extractionFailed: boolean;
}

/**
 * Readable prose, by the same algorithm on both sides.
 *
 * Readability returns null when it cannot find an article, which happens on a
 * near-empty document — exactly the case a blocked or JS-only page produces. We
 * fall back to the body's text content rather than reporting zero, because zero
 * would overstate the finding: an empty-looking page usually still has a nav.
 */
export function readable(html: string, url: string): Readable {
  if (!html.trim()) {
    return { chars: 0, text: '', title: '', extractionFailed: true };
  }

  let dom: JSDOM;
  try {
    dom = parse(html, url);
  } catch {
    return { chars: 0, text: '', title: '', extractionFailed: true };
  }

  try {
    const doc = dom.window.document;
    const documentTitle = doc.title ?? '';

    // Script and style bodies are not readable text, and counting them is not a
    // rounding error: a client-rendered page ships its content inside an inline
    // JSON payload, so a naive textContent read of that page comes back longer
    // than the rendered version and the JS dependency ratio inverts. Readability
    // strips these itself; the fallback below does not, so they go before both.
    for (const node of doc.querySelectorAll('script, style, noscript, template, svg')) {
      node.remove();
    }

    // Readability mutates the document it is given, so it gets a clone.
    const article = new Readability(doc.cloneNode(true) as Document, {
      charThreshold: 0,
      nbTopCandidates: 5,
    }).parse();

    const fromArticle = collapse(article?.textContent ?? '');
    if (fromArticle.length > 0) {
      return {
        chars: fromArticle.length,
        text: fromArticle,
        title: article?.title || documentTitle,
        extractionFailed: false,
      };
    }

    const fromBody = collapse(doc.body?.textContent ?? '');
    return {
      chars: fromBody.length,
      text: fromBody,
      title: documentTitle,
      extractionFailed: true,
    };
  } finally {
    dom.window.close();
  }
}

/**
 * Whitespace-collapsed length. Without this, a pretty-printed server-rendered
 * page scores higher than a minified one for reasons that have nothing to do
 * with how legible it is.
 */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * ratio = 1 - (raw / rendered)
 *
 * 0.0 means the plain response already carried everything. 1.0 means the plain
 * response carried nothing and the page only exists after JavaScript ran.
 *
 * Two edge cases decided here rather than at the call site:
 *   rendered is 0        nothing to depend on, so the ratio is 0, not 1
 *   raw exceeds rendered a server-rendered page whose script removes content.
 *                        Clamped to 0: negative dependency is not a thing.
 */
export function jsDependencyRatio(rawChars: number, renderedChars: number): number {
  if (renderedChars <= 0) return 0;
  const ratio = 1 - rawChars / renderedChars;
  return Math.max(0, Math.min(1, Number(ratio.toFixed(4))));
}

// ------------------------------------------------------------------ DOM facts

export interface DomFacts {
  h1Count: number;
  headingOrderBreaks: number;
  hasMain: boolean;
  title: string;
  metaDescription: string;
  /**
   * The icon the page declares, resolved against the document URL. Empty when
   * the page declares none, which is not the same as having none: /favicon.ico
   * is served by convention whether or not anyone links to it.
   */
  icon: string;
  canonical: string;
  ogPresent: string[];
  jsonLdTypes: string[];
  jsonLdErrors: string[];
  offerNodes: number;
  markdownLinkTag: boolean;
  headingIds: number;
  headings: number;
  forms: FormFacts[];
  links: string[];
  /** Text nodes that look like a price, counted in whatever HTML was given. */
  priceMatches: number;
}

export interface FormFacts {
  action: string;
  fields: number;
  labelled: number;
  named: number;
  withAutocomplete: number;
}

/**
 * Everything the structure, representation and actionability checks need from a
 * document, read once. Which HTML is passed in is the caller's decision and it
 * matters: `jsonld_present` reads the rendered DOM because tag managers inject
 * JSON-LD, while `pricing_structured` also wants to know what was in the raw
 * response, because a price only a browser can see is the finding.
 */
export function domFacts(html: string, url: string): DomFacts {
  const empty: DomFacts = {
    h1Count: 0,
    headingOrderBreaks: 0,
    hasMain: false,
    title: '',
    metaDescription: '',
    icon: '',
    canonical: '',
    ogPresent: [],
    jsonLdTypes: [],
    jsonLdErrors: [],
    offerNodes: 0,
    markdownLinkTag: false,
    headingIds: 0,
    headings: 0,
    forms: [],
    links: [],
    priceMatches: 0,
  };

  if (!html.trim()) return empty;

  let dom: JSDOM;
  try {
    dom = parse(html, url);
  } catch {
    return empty;
  }

  try {
    const doc = dom.window.document;

    const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    let previousLevel = 0;
    let orderBreaks = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      // A jump of more than one level down is a break. Going back up is not:
      // h2, h3, h2 is a well-formed document.
      if (previousLevel > 0 && level > previousLevel + 1) orderBreaks += 1;
      previousLevel = level;
    }

    const { types: jsonLdTypes, errors: jsonLdErrors, offers } = readJsonLd(doc);

    const ogPresent = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].filter(
      (property) => Boolean(meta(doc, `meta[property="${property}"]`)),
    );

    const markdownLinkTag = Boolean(
      doc.querySelector(
        'link[rel~="alternate"][type="text/markdown"], link[rel~="alternate"][type="text/x-markdown"]',
      ),
    );

    return {
      h1Count: doc.querySelectorAll('h1').length,
      headingOrderBreaks: orderBreaks,
      hasMain: Boolean(doc.querySelector('main, [role="main"]')),
      title: (doc.title ?? '').trim(),
      metaDescription: meta(doc, 'meta[name="description"]'),
      icon: iconHref(doc),
      canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? '',
      ogPresent,
      jsonLdTypes,
      jsonLdErrors,
      offerNodes: offers,
      markdownLinkTag,
      headingIds: headings.filter((h) => h.id).length,
      headings: headings.length,
      forms: [...doc.querySelectorAll('form')].map((form) => formFacts(form)),
      links: [...doc.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href') ?? '')
        .filter(Boolean),
      priceMatches: countPrices(doc.body?.textContent ?? ''),
    };
  } finally {
    dom.window.close();
  }
}

function meta(doc: Document, selector: string): string {
  return doc.querySelector(selector)?.getAttribute('content')?.trim() ?? '';
}

/**
 * The icon a page declares for itself, absolute.
 *
 * Preference order is largest-first among the rels browsers honour: an Apple
 * touch icon is at least 120px square and a plain `rel=icon` is often a 16px
 * ICO, and the one place this is shown is a 32px tile on a hi-dpi screen. We
 * report the href and nothing about it; whether it loads is the reader's
 * browser's problem, not a fact we are in a position to state.
 *
 * `href` is resolved through the anchor element rather than by string work
 * because a page may declare a protocol-relative or root-relative href and
 * jsdom already knows the document's base URL.
 */
function iconHref(doc: Document): string {
  const selectors = [
    'link[rel~="apple-touch-icon"][href]',
    'link[rel~="icon"][type="image/svg+xml"][href]',
    'link[rel~="icon"][href]',
    'link[rel~="shortcut"][href]',
  ];
  for (const selector of selectors) {
    const href = doc.querySelector(selector)?.getAttribute('href')?.trim();
    if (!href) continue;
    try {
      const anchor = doc.createElement('a');
      anchor.href = href;
      const resolved = anchor.href;
      // Only http(s). A data: icon would be inlined into every result payload,
      // and anything else is not something a browser will fetch for us.
      if (/^https?:\/\//i.test(resolved)) return resolved;
    } catch {
      // An href jsdom cannot resolve is an href a browser cannot either.
    }
  }
  return '';
}

function formFacts(form: Element): FormFacts {
  const fields = [...form.querySelectorAll('input, select, textarea')].filter((field) => {
    const type = field.getAttribute('type')?.toLowerCase();
    return type !== 'hidden' && type !== 'submit' && type !== 'button';
  });

  const labelled = fields.filter((field) => {
    if (field.getAttribute('aria-label')?.trim()) return true;
    if (field.getAttribute('aria-labelledby')?.trim()) return true;
    if (field.closest('label')) return true;
    const id = field.getAttribute('id');
    if (!id) return false;
    // CSS.escape is not in jsdom's global scope, so the attribute selector is
    // built by hand and quoted.
    return Boolean(form.ownerDocument.querySelector(`label[for="${cssQuote(id)}"]`));
  }).length;

  return {
    action: form.getAttribute('action') ?? '',
    fields: fields.length,
    labelled,
    named: fields.filter((f) => f.getAttribute('name')?.trim()).length,
    withAutocomplete: fields.filter((f) => {
      const token = f.getAttribute('autocomplete')?.trim().toLowerCase();
      return Boolean(token) && token !== 'off';
    }).length,
  };
}

function cssQuote(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function readJsonLd(doc: Document): { types: string[]; errors: string[]; offers: number } {
  const types = new Set<string>();
  const errors: string[] = [];
  let offers = 0;

  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const source = script.textContent ?? '';
    if (!source.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'unparseable JSON-LD block');
      continue;
    }
    walk(parsed);
  }

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node !== 'object' || node === null) return;

    const record = node as Record<string, unknown>;
    const type = record['@type'];
    if (typeof type === 'string') {
      types.add(type);
      if (type === 'Offer' || type === 'AggregateOffer') offers += 1;
    } else if (Array.isArray(type)) {
      for (const t of type) {
        if (typeof t !== 'string') continue;
        types.add(t);
        if (t === 'Offer' || t === 'AggregateOffer') offers += 1;
      }
    }
    for (const value of Object.values(record)) walk(value);
  }

  return { types: [...types].sort(), errors, offers };
}

/**
 * Text that reads as a price. Deliberately narrow: a currency symbol or code
 * next to a number. Counting these in the raw HTML and comparing against the
 * Offer nodes in JSON-LD is what tells us a price is on the page but not in a
 * form a machine can read.
 */
function countPrices(text: string): number {
  const matches = text.match(
    /(?:[$£€¥]\s?\d[\d,]*(?:\.\d{2})?)|(?:\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|usd|eur|gbp)\b)/g,
  );
  return matches?.length ?? 0;
}
