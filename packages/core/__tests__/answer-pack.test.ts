/**
 * The answer pack, from fixtures.
 *
 * These three files are the ones that could most easily lie. The fix pack's
 * files are mechanical — a robots block, a WAF rule — and there is not much
 * room in them to invent. An answer file is prose about a business, which is
 * exactly the shape a generator is tempted to fill in and exactly the shape a
 * reader will paste into their <head> without checking.
 *
 * So the tests below are mostly about restraint: that a question is only asked
 * when a page exists to answer it, that no answer is ever written, and that
 * every URL named is one the scan saw return 2xx.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildAnswerPack } from '../src/remedies';
import type { CheckResult } from '../src/types';

function fixture(name: string): CheckResult[] {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as CheckResult[];
}

const DOMAIN = 'example.com';

function pack(name: string) {
  const files = buildAnswerPack(DOMAIN, fixture(name));
  return {
    files,
    byName: (n: string) => files.find((f) => f.name === n)!,
  };
}

/** Every http(s) URL in a file, wherever it appears. */
function urlsIn(content: string): string[] {
  return [...content.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)].map((m) => m[0].replace(/[.,]$/, ''));
}

describe('the pack', () => {
  it('is three files, and names them the same way every time', () => {
    const { files } = pack('reference-a');
    expect(files.map((f) => f.name)).toEqual(['answers.html', 'fit.html', 'corroboration.md']);
  });

  it('is deterministic, which is what lets a preview match a download', () => {
    const once = buildAnswerPack(DOMAIN, fixture('reference-a'));
    const twice = buildAnswerPack(DOMAIN, fixture('reference-a'));
    expect(once.map((f) => f.content)).toEqual(twice.map((f) => f.content));
  });

  it('claims no check it does not move', () => {
    // corroboration.md is off-site work and nothing in the catalog scores it.
    // Pointing it at a check would be the first dishonest number in the pack.
    expect(pack('reference-a').byName('corroboration.md').addresses).toEqual([]);
  });
});

describe('answers.html', () => {
  it('never writes an answer', () => {
    // The whole safety property. A scan sees URLs, titles and descriptions; it
    // does not see the sentence that answers "how much does it cost", so every
    // answer has to arrive as a blank naming the page it comes from.
    const answers = pack('reference-a').byName('answers.html');
    const block = JSON.parse(answers.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    for (const entry of block.mainEntity) {
      expect(entry.acceptedAnswer.text).toMatch(/^<answer, from https?:\/\/.+>$/);
    }
  });

  it('emits a FAQPage a parser will accept', () => {
    const answers = pack('reference-a').byName('answers.html');
    const block = JSON.parse(answers.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    expect(block['@context']).toBe('https://schema.org');
    expect(block['@type']).toBe('FAQPage');
    expect(block.mainEntity.length).toBeGreaterThanOrEqual(2);
    for (const entry of block.mainEntity) {
      expect(entry['@type']).toBe('Question');
      expect(entry.name).toMatch(/\?$/);
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
    }
  });

  it('always asks the two questions that need no page behind them', () => {
    const answers = pack('reference-a').byName('answers.html');
    expect(answers.content).toMatch(/What is .+\?/);
    expect(answers.content).toMatch(/Who is .+ for\?/);
  });

  it('only asks a question the site has a page for', () => {
    // A pricing question on a site with no pricing page sends the reader
    // looking for an answer that is not there, which is worse than silence.
    const results = fixture('reference-a');
    const titles = results.find((r) => r.key === 'title_meta_distinct')!;
    const paths = ((titles.observed.pages ?? []) as Array<{ url: string; status: number }>)
      .filter((p) => p.status >= 200 && p.status < 300)
      .map((p) => new URL(p.url).pathname);

    const answers = buildAnswerPack(DOMAIN, results).find((f) => f.name === 'answers.html')!;
    if (!paths.some((p) => /^\/(pricing|plans|price)/i.test(p))) {
      expect(answers.content).not.toMatch(/How much does .+ cost\?/);
    }
    if (!paths.some((p) => /^\/(api|developers?|reference)/i.test(p))) {
      expect(answers.content).not.toMatch(/Does .+ have an API\?/);
    }
  });

  it('sources every answer from a URL the scan confirmed', () => {
    const results = fixture('reference-a');
    const live = new Set(
      ((results.find((r) => r.key === 'title_meta_distinct')!.observed.pages ?? []) as Array<{
        url: string;
        status: number;
      }>)
        .filter((p) => p.status >= 200 && p.status < 300)
        .map((p) => p.url),
    );

    const answers = buildAnswerPack(DOMAIN, results).find((f) => f.name === 'answers.html')!;
    const block = JSON.parse(answers.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    for (const entry of block.mainEntity) {
      const url = entry.acceptedAnswer.text.match(/https?:\/\/[^\s>]+/)![0];
      // The origin is the one fallback, for the two questions the site itself
      // answers; everything else has to be a page we actually fetched.
      expect(live.has(url) || url === `https://${DOMAIN}`).toBe(true);
    }
  });

  it('still produces the two universal questions for a site we could not read', () => {
    const answers = buildAnswerPack(DOMAIN, []).find((f) => f.name === 'answers.html')!;
    const block = JSON.parse(answers.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    expect(block.mainEntity).toHaveLength(2);
    expect(answers.incomplete).toBe(true);
  });
});

describe('fit.html', () => {
  it('leaves every commercial fact as a placeholder', () => {
    // A guessed price in JSON-LD is wrong in a form a machine believes, which
    // is the one failure mode worse than having no file.
    const fit = pack('reference-a').byName('fit.html');
    const block = JSON.parse(fit.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    expect(block.offers.price).toMatch(/^<.+>$/);
    expect(block.offers.priceCurrency).toMatch(/^<.+>$/);
    expect(block.audience.audienceType).toMatch(/^<.+>$/);
    for (const prop of block.additionalProperty) {
      expect(prop.value).toMatch(/^<.+>$/);
    }
  });

  it('carries the axes a constraint query is actually made of', () => {
    const fit = pack('reference-a').byName('fit.html');
    const block = JSON.parse(fit.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    const names = block.additionalProperty.map((p: { name: string }) => p.name);
    expect(names).toContain('Starting price');
    expect(names).toContain('Free tier');
    expect(names).toContain('Built for');
    expect(names).toContain('Integrates with');
  });

  it('points at a real pricing page when the site has one', () => {
    const results = fixture('reference-a');
    const pages = (results.find((r) => r.key === 'title_meta_distinct')!.observed.pages ??
      []) as Array<{ url: string; status: number }>;
    const pricing = pages.find(
      (p) => p.status >= 200 && p.status < 300 && /^\/(pricing|plans|price)/i.test(new URL(p.url).pathname),
    );
    const fit = buildAnswerPack(DOMAIN, results).find((f) => f.name === 'fit.html')!;
    const block = JSON.parse(fit.content.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!);
    if (pricing) expect(block.offers.url).toBe(pricing.url);
  });
});

describe('corroboration.md', () => {
  it('names the site rather than reading as a generic checklist', () => {
    const file = pack('reference-a').byName('corroboration.md');
    expect(file.content).toContain(DOMAIN);
  });

  it('mentions no URL outside the site it was generated for', () => {
    // It is a to-do list, so any link in it is one we are vouching for.
    const file = pack('reference-a').byName('corroboration.md');
    for (const url of urlsIn(file.content)) {
      expect(url.startsWith(`https://${DOMAIN}`)).toBe(true);
    }
  });

  it('says plainly what it cannot know', () => {
    const file = pack('reference-a').byName('corroboration.md');
    expect(file.content).toMatch(/will not tell you/i);
  });
});
