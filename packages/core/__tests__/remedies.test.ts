/**
 * The fix pack, from fixtures.
 *
 * The rule that matters most: every URL a generated file vouches for is one the
 * scan saw return 2xx. A file that names a dead URL redirects an agent's effort
 * rather than merely failing to direct it, which makes it worse than no file.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { catalog } from '../src/catalog';
import {
  buildFixPack,
  previewOf,
  punchListMarkdown,
  readFacts,
} from '../src/remedies';
import type { CheckResult } from '../src/types';

function fixture(name: string): CheckResult[] {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as CheckResult[];
}

/** Every URL a file mentions as a link, not as a comment. */
function linkedUrls(content: string): string[] {
  return [...content.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1] ?? '');
}

describe('the generated llms.txt', () => {
  const results = fixture('waf-blocked-spa');
  const pack = buildFixPack('linear.app', results);
  const file = pack.files.find((f) => f.name === 'llms.txt');

  it('exists and is built from the scan', () => {
    expect(file).toBeDefined();
    expect(file?.content).toContain('# Linear');
    expect(file?.content).toContain('> Purpose-built issue tracking');
    expect(file?.incomplete).toBe(false);
  });

  it('contains only URLs that returned 200 during the scan', () => {
    // The pages the scan actually fetched, with their statuses, live in the
    // title_meta_distinct observation. This reads them straight from the
    // evidence rather than from readFacts, so the test and the generator cannot
    // share a mistake.
    const pages = results.find((r) => r.key === 'title_meta_distinct')?.observed.pages as Array<{
      url: string;
      status: number;
    }>;
    const confirmed = new Set(pages.filter((p) => p.status === 200).map((p) => p.url));

    const linked = linkedUrls(file?.content ?? '');
    expect(linked.length).toBeGreaterThan(0);
    for (const url of linked) {
      expect(confirmed, `${url} was not confirmed by the scan`).toContain(url);
    }
  });

  it('refuses to vouch for a URL it did not fetch, even when the sitemap lists it', () => {
    // The fixture's sitemap names /integrations, /security and /customers.
    // The scan did not open them, so they may appear in a comment and nowhere
    // else.
    const content = file?.content ?? '';
    expect(content).toContain('https://linear.app/integrations');
    expect(linkedUrls(content)).not.toContain('https://linear.app/integrations');
    expect(content).toMatch(/did not open/);
  });

  it('drops a page whose status was not 2xx', () => {
    const withDead = results.map((r) =>
      r.key === 'title_meta_distinct'
        ? {
            ...r,
            observed: {
              ...r.observed,
              pages: [
                ...(r.observed.pages as unknown[]),
                { url: 'https://linear.app/gone', status: 404, title: 'Gone', description: '' },
                { url: 'https://linear.app/wall', status: 403, title: 'Wall', description: '' },
              ],
            },
          }
        : r,
    );
    const content = buildFixPack('linear.app', withDead).files.find((f) => f.name === 'llms.txt')?.content ?? '';
    expect(linkedUrls(content)).not.toContain('https://linear.app/gone');
    expect(linkedUrls(content)).not.toContain('https://linear.app/wall');
  });

  it('groups pages under the sections an agent expects, in order', () => {
    const content = file?.content ?? '';
    const pricing = content.indexOf('## Pricing');
    const docs = content.indexOf('## Documentation');
    const company = content.indexOf('## Company');
    const updates = content.indexOf('## Updates');
    expect(pricing).toBeGreaterThan(0);
    expect(docs).toBeGreaterThan(pricing);
    expect(company).toBeGreaterThan(docs);
    expect(updates).toBeGreaterThan(company);
  });

  it('names a page by its path when its title is only the brand', () => {
    // The fixture models a site where every page is titled "Linear", which is
    // why title_meta_distinct warns. Six entries all called "Linear" would be
    // a worse llms.txt than none.
    const content = file?.content ?? '';
    expect(content).toContain('[Pricing](https://linear.app/pricing)');
    expect(content).toContain('[Docs](https://linear.app/docs)');
    expect(content).not.toMatch(/\[Linear\]\(https:\/\/linear\.app\/pricing\)/);
  });

  it('is marked incomplete when the scan confirmed nothing beyond the homepage', () => {
    // One page is a heading with nothing under it, and the file says so
    // rather than being silently dropped from the pack.
    const homepageOnly = results.map((r) =>
      r.key === 'title_meta_distinct'
        ? {
            ...r,
            observed: {
              ...r.observed,
              pages: (r.observed.pages as Array<{ url: string }>).filter((p) =>
                p.url.endsWith('linear.app/'),
              ),
            },
          }
        : r,
    );
    const llms = buildFixPack('linear.app', homepageOnly).files.find((f) => f.name === 'llms.txt');
    expect(llms?.incomplete).toBe(true);
    expect(llms?.content).toContain('# Linear');
  });
});

describe('the corrected robots.txt block', () => {
  it('names the agents the edge refused, and says this file cannot fix that', () => {
    const pack = buildFixPack('linear.app', fixture('waf-blocked-spa'));
    const file = pack.files.find((f) => f.name === 'robots.txt');
    const content = file?.content ?? '';

    for (const agent of catalog.agents.filter((a) => a.role === 'agent')) {
      expect(content).toContain(agent.ua.split('/')[0]);
    }
    expect(content).toContain('HTTP 403');
    expect(content).toContain('cf-mitigated: challenge');
    expect(content).toMatch(/will not fix/);
    expect(content).toMatch(/Cloudflare/);
  });

  it('writes Allow lines for agents robots.txt itself disallows', () => {
    const results = fixture('reference-f');
    const pack = buildFixPack('example.com', results);
    const content = pack.files.find((f) => f.name === 'robots.txt')?.content ?? '';
    expect(content).toMatch(/User-agent: ClaudeBot\nAllow: \//);
    expect(content).toMatch(/User-agent: GPTBot\nAllow: \//);
  });

  it('is a baseline, not a fix, when nothing was refused', () => {
    const pack = buildFixPack('example.com', fixture('reference-a'));
    const content = pack.files.find((f) => f.name === 'robots.txt')?.content ?? '';
    expect(content).toMatch(/no reading agent refused/);
    expect(content).toMatch(/User-agent: \*\nAllow: \//);
  });
});

describe('the markdown alternate tags', () => {
  it('covers the top 20 URLs and no more', () => {
    const results = fixture('reference-a');
    const many = results.map((r) =>
      r.key === 'sitemap_present'
        ? {
            ...r,
            observed: {
              ...r.observed,
              urls: Array.from({ length: 60 }, (_, i) => ({
                loc: `https://example.com/page-${i}`,
                lastmod: null,
              })),
            },
          }
        : r,
    );
    const content = buildFixPack('example.com', many).files.find((f) => f.name === 'markdown-alternates.html')?.content ?? '';
    const tags = content.match(/<link rel="alternate" type="text\/markdown"/g) ?? [];
    expect(tags).toHaveLength(20);
  });

  it('puts the confirmed pages before the sitemap guesses', () => {
    const content = buildFixPack('linear.app', fixture('waf-blocked-spa')).files.find((f) => f.name === 'markdown-alternates.html')?.content ?? '';
    const pricing = content.indexOf('href="https://linear.app/pricing.md"');
    const integrations = content.indexOf('href="https://linear.app/integrations.md"');
    expect(pricing).toBeGreaterThan(0);
    expect(integrations).toBeGreaterThan(pricing);
  });

  it('spells out the Vary header, because a cache without it serves the wrong body', () => {
    const content = buildFixPack('linear.app', fixture('waf-blocked-spa')).files.find((f) => f.name === 'markdown-alternates.html')?.content ?? '';
    expect(content).toContain('Vary: Accept');
  });
});

describe('the JSON-LD block', () => {
  it('is valid JSON with only observed values, and placeholders where it would have had to guess', () => {
    const content = buildFixPack('linear.app', fixture('waf-blocked-spa')).files.find((f) => f.name === 'jsonld.html')?.content ?? '';
    const json = /<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/.exec(content)?.[1];
    expect(json).toBeDefined();

    const parsed = JSON.parse(json ?? '{}') as { '@graph': Array<Record<string, unknown>> };
    const org = parsed['@graph'].find((n) => n['@type'] === 'Organization');
    expect(org?.name).toBe('Linear');
    expect(org?.url).toBe('https://linear.app');
    expect(org?.description).toBe('Purpose-built issue tracking for software teams.');

    // The scan saw prices as text and no Offer node. The block carries the
    // shape and refuses to fill in the number.
    const product = parsed['@graph'].find((n) => n['@type'] === 'Product');
    const offer = product?.offers as Record<string, unknown>;
    expect(offer.price).toBe('<0.00>');
    expect(offer.priceCurrency).toBe('<USD>');
    expect(offer.url).toBe('https://linear.app/pricing');
  });

  it('never contains a price it did not observe in structured form', () => {
    // The fixture's page text has "$99" on it. A generator that lifted that
    // into an Offer would be guessing what it buys.
    const content = buildFixPack('linear.app', fixture('waf-blocked-spa')).files.find((f) => f.name === 'jsonld.html')?.content ?? '';
    expect(content).not.toMatch(/"price":\s*"99/);
  });

  it('leaves the Product out when the site already has Offer nodes', () => {
    const content = buildFixPack('example.com', fixture('reference-a')).files.find((f) => f.name === 'jsonld.html')?.content ?? '';
    expect(content).not.toContain('"@type": "Product"');
    expect(content).toContain('Your page already carries: Offer, Organization, Product');
  });
});

describe('the punch list', () => {
  it('orders by effort first, then by points', () => {
    const { punchList } = buildFixPack('linear.app', fixture('waf-blocked-spa'));
    const order = { minutes: 0, hours: 1, days: 2 };
    for (let i = 1; i < punchList.length; i += 1) {
      const prev = punchList[i - 1];
      const next = punchList[i];
      if (!prev || !next) throw new Error('unreachable');
      const byEffort = order[prev.effort] - order[next.effort];
      expect(byEffort).toBeLessThanOrEqual(0);
      if (byEffort === 0) expect(prev.pointsRecovered).toBeGreaterThanOrEqual(next.pointsRecovered);
    }
  });

  it('puts the WAF fix in the last band even though it is worth the most', () => {
    // Worth the most points and owned by somebody else's WAF console, so it
    // sits behind every fix a reader can finish themselves this afternoon.
    const { punchList } = buildFixPack('linear.app', fixture('waf-blocked-spa'));
    const parity = punchList.find((i) => i.key === 'agent_status_parity');
    const most = Math.max(...punchList.map((i) => i.pointsRecovered));
    expect(parity?.pointsRecovered).toBe(most);
    expect(parity?.effort).toBe('days');

    const index = punchList.findIndex((i) => i.key === 'agent_status_parity');
    const before = punchList.slice(0, index);
    expect(before.every((i) => i.effort !== 'days' || i.pointsRecovered >= most)).toBe(true);
    expect(before.some((i) => i.effort === 'minutes')).toBe(true);
  });

  it('has an entry for every check that can fail', () => {
    const { punchList } = buildFixPack('example.com', fixture('reference-f'));
    expect(punchList.map((i) => i.key).sort()).toEqual([...catalog.checks.map((c) => c.key)].sort());
  });

  it('leaves out a check that errored, because there is nothing to fix', () => {
    const { punchList } = buildFixPack('example.com', fixture('skips-and-errors'));
    expect(punchList.map((i) => i.key)).not.toContain('agent_status_parity');
  });

  it('renders as markdown with the quick wins counted', () => {
    const pack = buildFixPack('linear.app', fixture('waf-blocked-spa'));
    const md = punchListMarkdown('linear.app', pack.punchList);
    expect(md).toContain('# What to fix on linear.app');
    expect(md).toContain('## Minutes of work');
    expect(md).toMatch(/minutes of work and (is|are) worth \d+ of the \d+ points/);
  });
});

describe('the paywall preview', () => {
  it('cuts a real file off part way through, and says so', () => {
    const pack = buildFixPack('linear.app', fixture('waf-blocked-spa'));
    const file = pack.files.find((f) => f.name === 'llms.txt');
    if (!file) throw new Error('no llms.txt');

    const preview = previewOf(file, 9);
    expect(preview.truncated).toBe(true);

    const lines = preview.text.split('\n');
    expect(lines.length).toBeLessThanOrEqual(9);
    // The last line has words on it and stops mid-way, so the cut reads as a
    // cut rather than as the end of a short file.
    expect(lines[lines.length - 1]).toMatch(/\S.* …$/);

    // Everything shown is a prefix of the real file. No mock, no sample text.
    const shown = lines.slice(0, -1).join('\n');
    expect(file.content.startsWith(shown)).toBe(true);
    const lastReal = file.content.split('\n')[lines.length - 1] ?? '';
    expect(lastReal.startsWith((lines[lines.length - 1] ?? '').replace(/ …$/, ''))).toBe(true);
  });

  it('shows a short file whole rather than pretending it is longer', () => {
    const preview = previewOf(
      { name: 'x', purpose: '', language: 'text', content: 'one\ntwo\n', addresses: [], incomplete: false },
      9,
    );
    expect(preview.truncated).toBe(false);
    expect(preview.text).toBe('one\ntwo\n');
  });
});

describe('readFacts', () => {
  it('never returns a page the scan did not see succeed', () => {
    const facts = readFacts(fixture('waf-blocked-spa'));
    expect(facts.pages.every((p) => p.status >= 200 && p.status < 300)).toBe(true);
    expect(facts.pages.length).toBe(5);
  });

  it('separates a robots.txt refusal from an edge refusal', () => {
    const facts = readFacts(fixture('waf-blocked-spa'));
    // The WAF fixture: robots.txt allows everyone, the edge refuses the agents.
    expect(facts.refusedByRobots).toEqual([]);
    expect(facts.refusedByEdge.map((r) => r.id).sort()).toEqual(
      ['claudebot', 'googleext', 'gptbot', 'perplexity'],
    );
    expect(facts.refusedByEdge[0]?.cfMitigated).toBe('challenge');
  });
});
