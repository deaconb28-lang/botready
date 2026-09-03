/**
 * The prioritised punch list.
 *
 * Order is points recovered per unit of effort, which is not the same as the
 * findings list on the result page. The findings list is worst first, and the
 * worst thing on most sites is a WAF rule somebody else owns. This list puts
 * the twenty-minute fixes above the two-week ones even when the two-week one is
 * worth more points, because a punch list nobody starts is worth nothing.
 *
 * Effort is a fixed property of the remedy, not a guess about a codebase: an
 * llms.txt is a file you write once, and prerendering a client-rendered app is
 * not, whatever the app is.
 */

import { checkDef } from '../catalog';
import { findings } from '../findings';
import type { CheckResult } from '../types';

export type Effort = 'minutes' | 'hours' | 'days';

export interface PunchItem {
  key: string;
  /** What to do, as an instruction. */
  title: string;
  /** Why it is here and what it buys, in one or two sentences. */
  rationale: string;
  pointsRecovered: number;
  effort: Effort;
  /** Who has to do it, which is often not the person reading this. */
  owner: 'content' | 'frontend' | 'backend' | 'infrastructure';
  /** The generated file that does most of the work, when there is one. */
  file?: string;
}

interface Remedy {
  title: string;
  effort: Effort;
  owner: PunchItem['owner'];
  file?: string;
  /** Why this is worth doing, in the product's voice. */
  rationale: string;
}

/**
 * One entry per check that can fail. Keyed by check, not by the catalog's
 * `remedy` field, because several checks share a remedy file and each still
 * needs its own instruction.
 */
const REMEDIES: Record<string, Remedy> = {
  llms_txt_present: {
    title: 'Publish the generated llms.txt at your root',
    effort: 'minutes',
    owner: 'content',
    file: 'llms.txt',
    rationale:
      'One file, already written for you from your own pages. It is the cheapest point on this list and the only one you can finish before your coffee goes cold.',
  },
  robots_agent_rules: {
    title: 'Replace the robots.txt rules that refuse reading agents',
    effort: 'minutes',
    owner: 'infrastructure',
    file: 'robots.txt',
    rationale:
      'The generated block names the exact tokens currently disallowed. If the rules were deliberate, keep them and ignore this. Most are not.',
  },
  cache_headers: {
    title: 'Send Last-Modified or ETag on your HTML responses',
    effort: 'minutes',
    owner: 'infrastructure',
    file: undefined,
    rationale:
      'One header in your CDN config. It turns every re-read of your site by everything that reads it regularly into a conditional request that usually costs nothing.',
  },
  canonical_og: {
    title: 'Add the canonical link and the missing OpenGraph tags',
    effort: 'minutes',
    owner: 'frontend',
    rationale:
      'Head tags on a template. The canonical stops every parameterised copy of a URL being counted as a separate page, and the OpenGraph tags are what gets quoted when you are cited.',
  },
  jsonld_present: {
    title: 'Paste the generated JSON-LD block into your head',
    effort: 'minutes',
    owner: 'frontend',
    file: 'jsonld.html',
    rationale:
      'Twenty lines that say what kind of thing this is. The generated block is filled in from your own pages, with placeholders where the scan would have had to guess.',
  },
  markdown_alternate: {
    title: 'Advertise a markdown representation',
    effort: 'hours',
    owner: 'frontend',
    file: 'markdown-alternates.html',
    rationale:
      'The link tags are a paste. Producing the markdown behind them is the actual work, and if your content is already markdown before it becomes HTML, most of it is done.',
  },
  sitemap_present: {
    title: 'Publish a sitemap and declare it in robots.txt',
    effort: 'hours',
    owner: 'backend',
    rationale:
      'Without one, an agent reads what it can reach in two hops and stops, which on most sites means it never sees the documentation.',
  },
  sitemap_lastmod_real: {
    title: 'Make sitemap lastmod reflect the change, not the build',
    effort: 'hours',
    owner: 'backend',
    rationale:
      'One date across every URL carries no information, which is worse than an empty field because it looks like information.',
  },
  robots_present: {
    title: 'Publish a robots.txt',
    effort: 'minutes',
    owner: 'infrastructure',
    file: 'robots.txt',
    rationale:
      'It is the first path anything asks for. A robots.txt that allows everything is still better than none, because a default you did not choose is being applied instead.',
  },
  title_meta_distinct: {
    title: 'Give every page its own title and description',
    effort: 'hours',
    owner: 'content',
    rationale:
      'These are the two lines quoted when you are cited. Shared across pages, every citation points at your site rather than at the page that answered the question.',
  },
  semantic_landmarks: {
    title: 'Fix the heading tree and add a main landmark',
    effort: 'hours',
    owner: 'frontend',
    rationale:
      'An agent uses the heading tree to find the part of a page that answers its question. A broken tree makes it read the whole document, which costs it more and gets you a worse summary.',
  },
  pricing_structured: {
    title: 'Put your prices in an Offer node',
    effort: 'hours',
    owner: 'frontend',
    file: 'jsonld.html',
    rationale:
      '"What does this cost" is the most common question asked about a company. Right now the answer needs a browser, or needs guessing which number on the page is the price.',
  },
  form_semantics: {
    title: 'Label your form fields and add autocomplete tokens',
    effort: 'hours',
    owner: 'frontend',
    rationale:
      'An agent reads the label to know what a field wants. A placeholder is not a label, and this is the same change that makes the form work with a screen reader.',
  },
  api_docs_reachable: {
    title: 'Link your API docs from the homepage',
    effort: 'minutes',
    owner: 'content',
    rationale:
      'One anchor. If the documentation exists and nothing on the homepage points at it, the path to it is longer than an agent will walk.',
  },
  content_negotiation: {
    title: 'Honour Accept: text/markdown',
    effort: 'hours',
    owner: 'backend',
    file: 'markdown-alternates.html',
    rationale:
      'The strongest form of the markdown fix and the one that needs no second URL. Remember Vary: Accept, or a cache will serve the wrong body to everyone.',
  },
  agent_manifest: {
    title: 'Publish an agent manifest under /.well-known',
    effort: 'hours',
    owner: 'backend',
    rationale:
      'The least settled convention we check, and the only one that describes actions rather than text. Worth doing after everything above it.',
  },
  redirect_depth: {
    title: 'Collapse the redirect chain to one hop',
    effort: 'hours',
    owner: 'infrastructure',
    rationale:
      'Usually one canonical rule stacked on another: apex to www, then locale, then trailing slash. Each hop is a round trip paid before any text arrives.',
  },
  raw_fetch_latency: {
    title: 'Get time to first byte under a second',
    effort: 'days',
    owner: 'backend',
    rationale:
      'An agent working a list of sources gives each one a budget. Most of yours is spent before any text has arrived.',
  },
  no_wall_on_docs: {
    title: 'Take the wall off your docs and pricing paths',
    effort: 'hours',
    owner: 'infrastructure',
    rationale:
      'A path that answers 401, 403 or a challenge is invisible to every answer written about you. If the wall is deliberate on those paths, this is not a finding.',
  },
  agent_status_parity: {
    title: 'Stop your edge refusing reading agents',
    effort: 'days',
    owner: 'infrastructure',
    file: 'robots.txt',
    rationale:
      'Worth the most points on this list and last in it, because it is a rule in a product in front of your application and usually owned by someone other than whoever is reading this. Start the conversation now and do the quick wins above while it happens.',
  },
  js_dependency_ratio: {
    title: 'Serve your page text without JavaScript',
    effort: 'days',
    owner: 'frontend',
    rationale:
      'The largest structural item here. Server-side rendering or prerendering the pages that matter — pricing and docs first — recovers most of it without touching the rest of the app.',
  },
};

const EFFORT_ORDER: Record<Effort, number> = { minutes: 0, hours: 1, days: 2 };

export function buildPunchList(results: CheckResult[], version?: string): PunchItem[] {
  const items: PunchItem[] = [];

  for (const finding of findings(results, version)) {
    // A check that errored has no remedy: we do not know what is wrong.
    if (finding.status === 'error') continue;

    const remedy = REMEDIES[finding.key];
    if (!remedy) continue;

    items.push({
      key: finding.key,
      title: remedy.title,
      rationale: remedy.rationale,
      pointsRecovered: finding.pointsLost,
      effort: remedy.effort,
      owner: remedy.owner,
      ...(remedy.file ? { file: remedy.file } : {}),
    });
  }

  // Cheapest effort first, then most points inside a band. A punch list nobody
  // starts is worth nothing, and the first item being a two-week refactor is
  // how that happens.
  return items.sort((a, b) => {
    const byEffort = EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort];
    if (byEffort !== 0) return byEffort;
    if (b.pointsRecovered !== a.pointsRecovered) return b.pointsRecovered - a.pointsRecovered;
    return a.key.localeCompare(b.key);
  });
}

/** The punch list as a markdown file, for the download. */
export function punchListMarkdown(domain: string, items: PunchItem[]): string {
  const lines: string[] = [];
  lines.push(`# What to fix on ${domain}`);
  lines.push('');
  lines.push(
    'Ordered by effort, then by points, so the things you can finish today are at the top. The result page orders the same findings worst first, which is a different question.',
  );
  lines.push('');

  const total = items.reduce((sum, item) => sum + item.pointsRecovered, 0);
  const quick = items.filter((item) => item.effort === 'minutes');
  const quickPoints = quick.reduce((sum, item) => sum + item.pointsRecovered, 0);

  if (quick.length > 0) {
    lines.push(
      `${quick.length} of these ${quick.length === 1 ? 'item is' : 'items are'} minutes of work and ${
        quick.length === 1 ? 'is' : 'are'
      } worth ${quickPoints} of the ${total} points on the table.`,
    );
    lines.push('');
  }

  for (const band of ['minutes', 'hours', 'days'] as const) {
    const inBand = items.filter((item) => item.effort === band);
    if (inBand.length === 0) continue;

    lines.push(`## ${bandHeading(band)}`);
    lines.push('');
    for (const item of inBand) {
      lines.push(`### ${item.title}`);
      lines.push('');
      lines.push(
        `**+${item.pointsRecovered} ${item.pointsRecovered === 1 ? 'point' : 'points'}** · ${item.owner}${
          item.file ? ` · see \`${item.file}\`` : ''
        } · check \`${item.key}\``,
      );
      lines.push('');
      lines.push(item.rationale);
      const def = checkDef(item.key);
      if (def?.fails_when) {
        lines.push('');
        lines.push(`Fails when: ${def.fails_when}.`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'Re-run the scan after each change rather than after all of them. The only proof that a client can read your site is that it did.',
  );
  lines.push('');

  return lines.join('\n');
}

function bandHeading(effort: Effort): string {
  switch (effort) {
    case 'minutes':
      return 'Minutes of work';
    case 'hours':
      return 'An afternoon each';
    case 'days':
      return 'Structural, and worth planning';
  }
}
