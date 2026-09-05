/**
 * A finding, in the words a founder would use.
 *
 * The core `findings()` function turns evidence into one factual headline and
 * body per check; this dresses it for the page. Every number below came out of
 * `observed` — none of it is invented here.
 *
 * There was a second, technical register alongside this one, chosen by a switch
 * in the header. The switch is gone and so is that register: two voices meant
 * every sentence had to be written twice and only one of them was ever read.
 */

import type { Finding, PerAgentFetch } from '@botready/core';


export interface FindingCopy {
  title: string;
  body: string;
  /** The violet chip: what the fix is, in two or three words. */
  fix: string;
  /** The raw request, response or count, printed as it happened. */
  detail: string;
  points: string;
}

/** The fix chip per remedy key. */
const FIX_CHIP: Record<string, string> = {
  waf_allow_agents: 'one rule change',
  prerender_key_pages: 'pre-render or add llms.txt',
  robots_block: 'two lines in robots.txt',
  llms_txt: 'included in the pack',
  markdown_alternate_tags: 'link tags included',
  jsonld_block: 'JSON-LD block included',
};

export function copyFor(finding: Finding, observed: Record<string, unknown>): FindingCopy {
  const chip = finding.remedy ? FIX_CHIP[finding.remedy] : undefined;
  return {
    title: plainTitle(finding, observed),
    body: finding.body || finding.headline,
    fix: chip ?? 'a manual fix',
    detail: `${finding.evidence}\n\ncheck: ${finding.key} — ${finding.status}`,
    points: `${finding.pointsLost} pts`,
  };
}

// ------------------------------------------------------------------ plain

function plainTitle(f: Finding, o: Record<string, unknown>): string {
  switch (f.key) {
    case 'agent_status_parity': {
      const refused = refusedAgents(o);
      if (refused.length === 0) return f.headline;
      if (refused.length === 1) return `${refused[0]} is being turned away`;
      if (refused.length === 2) return `${refused[0]} and ${refused[1]} are being turned away`;
      return `${refused.length} of the AI clients are being turned away`;
    }
    case 'js_dependency_ratio':
      return f.status === 'fail' ? 'Your words only appear after JavaScript runs' : 'Some of your words only appear after JavaScript runs';
    case 'llms_txt_present':
      return 'No llms.txt';
    case 'pricing_structured':
      return 'Your pricing page has no structured data';
    case 'jsonld_present':
      return 'Nothing on the page says what it is, as data';
    case 'robots_agent_rules':
      return 'Your robots.txt turns reading agents away';
    case 'robots_present':
      return 'No robots.txt';
    case 'sitemap_present':
      return 'No sitemap, or an empty one';
    case 'markdown_alternate':
      return 'No plain-text version is advertised';
    case 'canonical_og':
      return 'The page does not say which URL is the real one';
    case 'agent_manifest':
      return 'Nothing tells an agent what it can do here';
    case 'api_docs_reachable':
      return 'Your API docs are hard to find from the front door';
    case 'cache_headers':
      return 'The page never says when it last changed';
    case 'sitemap_lastmod_real':
      return 'The sitemap dates are not maintained';
    default:
      return f.headline;
  }
}

// ------------------------------------------------------------------ helpers

function refusedAgents(o: Record<string, unknown>): string[] {
  const perAgent = (o.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const control = String(o.control ?? 'chrome');
  return Object.entries(perAgent)
    .filter(([id, v]) => id !== control && (v.status >= 400 || v.status === 0))
    .map(([id]) => shortName(id));
}

function shortName(id: string): string {
  return { chrome: 'Chrome', claudebot: 'Claude', gptbot: 'GPT', perplexity: 'Perplexity', googleext: 'Google' }[id] ?? id;
}

