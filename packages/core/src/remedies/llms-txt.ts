/**
 * The generated llms.txt.
 *
 * Built from the pages the scan actually fetched and saw return 2xx, with their
 * real titles and their real meta descriptions. Not from the sitemap's raw URL
 * list: the point of llms.txt is to say which pages matter, and a copy of a
 * 214-entry sitemap says nothing that the sitemap did not already say.
 *
 * The one rule tested in CI: every URL in this file returned 200 during the
 * scan. A generated file that names a dead URL is worse than no file, because
 * it redirects an agent's effort rather than merely failing to direct it.
 */

import type { FixFile, ScanFacts } from './index';
import { oneLine, pathOf } from './shared';

/**
 * The sections an llms.txt reader expects, and the path patterns that belong in
 * each. Order matters: it is the order an agent reads them in.
 */
const SECTIONS: Array<{ title: string; matches: RegExp }> = [
  { title: 'Product', matches: /^\/(product|features?|platform|solutions?)?$/i },
  { title: 'Pricing', matches: /^\/(pricing|plans|billing)/i },
  { title: 'Documentation', matches: /^\/(docs|documentation|guides?|help|support)/i },
  { title: 'API', matches: /^\/(api|developers?|reference|sdk)/i },
  { title: 'Company', matches: /^\/(about|company|team|careers?|contact|legal|privacy|terms)/i },
  { title: 'Updates', matches: /^\/(blog|changelog|news|updates|releases|press)/i },
];

export function buildLlmsTxt(domain: string, facts: ScanFacts): FixFile {
  const lines: string[] = [];

  const title = facts.siteTitle || domain;
  lines.push(`# ${stripSuffix(title, domain)}`);

  if (facts.siteDescription) {
    lines.push(`> ${oneLine(facts.siteDescription)}`);
  }
  lines.push('');

  // Grouped, and only pages the scan confirmed.
  const grouped = new Map<string, typeof facts.pages>();
  const ungrouped: typeof facts.pages = [];

  for (const page of facts.pages) {
    const path = pathOf(page.url);
    // The homepage is the subject of the heading above, not an entry under it.
    if (path === '/' || path === '') continue;

    const section = SECTIONS.find((s) => s.matches.test(path));
    if (section) {
      const bucket = grouped.get(section.title) ?? [];
      bucket.push(page);
      grouped.set(section.title, bucket);
    } else {
      ungrouped.push(page);
    }
  }

  for (const section of SECTIONS) {
    const pages = grouped.get(section.title);
    if (!pages || pages.length === 0) continue;
    lines.push(`## ${section.title}`);
    for (const page of pages) lines.push(entry(page, domain));
    lines.push('');
  }

  if (ungrouped.length > 0) {
    lines.push('## Other pages');
    for (const page of ungrouped) lines.push(entry(page, domain));
    lines.push('');
  }

  // Everything the scan saw is above. Everything the sitemap claims but the
  // scan did not open is named here as a count and a note, never as an entry,
  // because we cannot vouch for a URL we did not fetch.
  const unverified = facts.sitemap.urls.filter(
    (u) => !facts.pages.some((p) => sameIsh(p.url, u.loc)),
  );

  if (unverified.length > 0) {
    lines.push('<!--');
    lines.push(
      `  Your sitemap lists ${unverified.length} more ${
        unverified.length === 1 ? 'URL' : 'URLs'
      } that this scan did not open. We read at most 6 pages, so we`,
    );
    lines.push('  will not vouch for a URL we did not fetch. Add the ones that matter:');
    for (const url of unverified.slice(0, 20)) {
      lines.push(`  - ${url.loc}`);
    }
    if (unverified.length > 20) lines.push(`  ... and ${unverified.length - 20} more`);
    lines.push('-->');
    lines.push('');
  }

  const bodyPages = facts.pages.filter((p) => pathOf(p.url) !== '/' && pathOf(p.url) !== '');

  return {
    name: 'llms.txt',
    purpose: `Serve this at https://${domain}/llms.txt. It tells a reading agent which of your pages matter, in the order they matter.`,
    language: 'markdown',
    content: lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n',
    addresses: ['llms_txt_present'],
    // Six URLs is a real llms.txt. One is a heading with nothing under it.
    incomplete: bodyPages.length === 0,
  };
}

function entry(page: { url: string; title: string; description: string }, domain: string): string {
  const description = page.description ? `: ${oneLine(page.description)}` : '';
  return `- [${labelFor(page.title, page.url, domain)}](${page.url})${description}`;
}

/**
 * What to call a page in the index.
 *
 * The page's own title, with the brand suffix removed. But a title that is only
 * the brand carries nothing — which is exactly the site that failed
 * title_meta_distinct — and an llms.txt where six entries are all called
 * "Linear" is worse than no llms.txt. So when the title says nothing, the path
 * does, because a path is at least specific to the page.
 */
function labelFor(title: string, url: string, domain: string): string {
  const brand = (domain.split('.')[0] ?? domain).toLowerCase();
  const stripped = stripSuffix(title, domain);

  if (stripped && stripped.toLowerCase() !== brand && stripped.toLowerCase() !== domain) {
    return stripped;
  }
  return humanisePath(pathOf(url));
}

/** `/api/reference` -> `Api reference`. Specific, if not elegant. */
function humanisePath(path: string): string {
  const words = path.split('/').filter(Boolean).join(' ').replace(/[-_]+/g, ' ').trim();
  if (!words) return 'Home';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `Pricing — Example` on example.com becomes `Pricing`. */
function stripSuffix(title: string, domain: string): string {
  const brand = domain.split('.')[0] ?? domain;
  const pattern = new RegExp(`\\s*[—|·\\-–]\\s*${escapeRegExp(brand)}\\s*$`, 'i');
  return title.replace(pattern, '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Two URLs for the same page, allowing for a trailing slash. */
function sameIsh(a: string, b: string): boolean {
  const norm = (s: string) => {
    try {
      const u = new URL(s);
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
    } catch {
      return s.replace(/\/$/, '');
    }
  };
  return norm(a) === norm(b);
}
