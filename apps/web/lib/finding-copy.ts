/**
 * A finding in two registers.
 *
 * The core `findings()` function turns evidence into one factual headline and
 * body per check. Plain mode speaks to a founder; technical mode names the
 * check, its status and the numbers. Both read the same observed facts, and
 * neither invents one: every number below came out of `observed`.
 */

import type { Finding, PerAgentFetch } from '@botready/core';

import type { Mode } from './mode';
import { CLIENT_NAMES } from './theme';

export interface FindingCopy {
  title: string;
  body: string;
  /** The violet chip: what the fix is, in two or three words. */
  fix: string;
  /** The raw request, response or count, printed as it happened. */
  detail: string;
  points: string;
}

/** The fix chip per remedy key, in both registers. */
const FIX_CHIP: Record<string, { plain: string; tech: string }> = {
  waf_allow_agents: { plain: 'one rule change', tech: 'WAF rule' },
  prerender_key_pages: { plain: 'pre-render or add llms.txt', tech: 'pre-render' },
  robots_block: { plain: 'two lines in robots.txt', tech: 'robots.txt block' },
  llms_txt: { plain: 'included in the pack', tech: 'generated file' },
  markdown_alternate_tags: { plain: 'link tags included', tech: 'Link tags' },
  jsonld_block: { plain: 'JSON-LD block included', tech: 'JSON-LD block' },
};

export function copyFor(finding: Finding, observed: Record<string, unknown>, mode: Mode): FindingCopy {
  const points = `${finding.pointsLost} pts`;
  const chip = finding.remedy ? FIX_CHIP[finding.remedy] : undefined;
  const fix = chip ? (mode === 'tech' ? `${finding.pointsLost} points · ${chip.tech}` : chip.plain) : mode === 'tech' ? `${finding.pointsLost} points · manual` : 'a manual fix';
  const detail = `${finding.evidence}\n\ncheck: ${finding.key} — ${finding.status}`;

  if (mode === 'tech') {
    return {
      title: techTitle(finding, observed),
      body: techBody(finding, observed),
      fix,
      detail,
      points,
    };
  }

  return {
    title: plainTitle(finding, observed),
    body: finding.body || finding.headline,
    fix,
    detail,
    points,
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

// ------------------------------------------------------------------ technical

function techTitle(f: Finding, o: Record<string, unknown>): string {
  const suffix = f.status === 'warn' ? 'warn' : f.status === 'error' ? 'error' : 'fail';
  switch (f.key) {
    case 'js_dependency_ratio': {
      const ratio = Number(o.ratio ?? 0);
      return `${f.key} — ${suffix} (${ratio.toFixed(2)})`;
    }
    case 'raw_fetch_latency': {
      const ttfb = Number(o.ttfb_ms ?? o.control_ttfb_ms ?? 0);
      return ttfb ? `${f.key} — ${suffix} (${ttfb} ms)` : `${f.key} — ${suffix}`;
    }
    case 'redirect_depth': {
      const hops = Number(o.hops ?? o.redirects ?? 0);
      return hops ? `${f.key} — ${suffix} (${hops} hops)` : `${f.key} — ${suffix}`;
    }
    default:
      return `${f.key} — ${suffix}`;
  }
}

function techBody(f: Finding, o: Record<string, unknown>): string {
  switch (f.key) {
    case 'agent_status_parity': {
      const perAgent = (o.per_agent ?? {}) as Record<string, PerAgentFetch>;
      const control = String(o.control ?? 'chrome');
      const controlStatus = perAgent[control]?.status ?? 0;
      const refused = Object.entries(perAgent).filter(([id, v]) => id !== control && statusClass(v.status) !== statusClass(controlStatus));
      if (refused.length === 0) return f.body;
      const list = refused.map(([id, v]) => `${CLIENT_NAMES[id] ?? id} ${v.transport_error ? 'no response' : v.status}`).join(', ');
      return `${list} from the same URL that returns ${controlStatus} to the Chrome control, in the same second.`;
    }
    case 'js_dependency_ratio': {
      const raw = Number(o.raw_chars ?? 0);
      const rendered = Number(o.rendered_chars ?? 0);
      return `Extractable text from the raw response is ${raw.toLocaleString('en-US')} characters against ${rendered.toLocaleString('en-US')} from the headless render.`;
    }
    case 'llms_txt_present': {
      const status = Number(o.status ?? 0);
      return `GET /llms.txt returned ${status || 'no response'}${o.served_html ? ' with the HTML shell rather than a text file' : ''}. The fix pack generates it from the pages that returned 200.`;
    }
    case 'pricing_structured': {
      const nodes = Number(o.offer_nodes ?? 0);
      return nodes === 0 ? 'No ld+json Offer node on the pricing page. Prices are present in the DOM as markup only.' : f.body;
    }
    case 'jsonld_present': {
      const types = Array.isArray(o.types) ? (o.types as string[]) : [];
      return types.length === 0 ? 'No ld+json block on the target page.' : `ld+json types present: ${types.join(', ')}. ${f.body}`;
    }
    default:
      return f.body || f.headline;
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

function statusClass(status: number): number {
  return Math.floor(status / 100);
}
