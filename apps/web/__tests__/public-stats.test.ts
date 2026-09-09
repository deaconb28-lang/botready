/**
 * The numbers we publish about ourselves.
 *
 * This page is an argument against how the category talks: round figures with
 * no method attached. The argument only holds if every rate we print carries
 * the count it was taken over and a sentence saying what it counted, so that
 * is most of what is asserted here.
 *
 * The other half is the asymmetry denominator. "75% of sites let Google
 * through" is a very different claim from "75% of the sites that block
 * somebody let Google through", and the second one is the true one.
 */

import { describe, expect, it } from 'vitest';

import { statsMarkdown } from '../lib/markdown';
import { asymmetryShare, type PublicStats } from '../lib/stats-data';

const stats = (over: Partial<PublicStats> = {}): PublicStats => ({
  clients: [
    { agentId: 'chrome', label: 'Chrome', isControl: true, asked: 350, refused: 4, served: 346, refusedPct: 1 },
    { agentId: 'claudebot', label: 'ClaudeBot', isControl: false, asked: 350, refused: 32, served: 318, refusedPct: 9 },
  ],
  asymmetry: { scans: 350, browserServed: 340, divergent: 28, googleAllowedOthersNot: 21 },
  checks: [
    { key: 'agent_manifest', label: 'Agent manifest', category: 'actionability', ran: 340, failed: 306, failedPct: 90 },
  ],
  outcomes: { scans: 405, complete: 340, blocked: 28, errored: 37, blockedPct: 7 },
  profiles: [
    { profile: 'local-service', scoringVersion: '1.4', scored: 44, median: 59, worst: 21, best: 88 },
  ],
  readAt: '2026-09-09T12:00:00.000Z',
  ...over,
});

describe('the asymmetry share', () => {
  it('is taken over the sites that refused somebody, not over every site', () => {
    // 21 of 28 divergent sites, not 21 of 350 scans. The second number is 6%
    // and says the opposite thing.
    expect(asymmetryShare({ scans: 350, browserServed: 340, divergent: 28, googleAllowedOthersNot: 21 })).toBe(75);
  });

  it('says nothing rather than nought when nothing diverged', () => {
    // A percentage of an empty set is not zero percent, and printing "0% of
    // sites" would claim we looked and found none.
    expect(asymmetryShare({ scans: 12, browserServed: 12, divergent: 0, googleAllowedOthersNot: 0 })).toBeNull();
    expect(asymmetryShare(null)).toBeNull();
  });
});

describe('the stats markdown', () => {
  it('puts a denominator beside every rate', () => {
    const md = statsMarkdown(stats());
    expect(md).toContain('refused on 9% of 350 scans');
    expect(md).toContain('failed by 90% of 340 scans');
    expect(md).toContain('from 44 sites');
    expect(md).toContain('75% of them');
  });

  it('names the population the asymmetry is about', () => {
    expect(statsMarkdown(stats())).toContain('Of 28 sites that served a browser and refused at least one AI client');
  });

  it('says what a refusal counted before quoting a refusal rate', () => {
    const md = statsMarkdown(stats());
    expect(md).toContain('Refused counts a 4xx or a 5xx');
    expect(md.indexOf('Refusal rate by client')).toBeLessThan(md.indexOf('Refused counts a 4xx'));
  });

  it('drops a section rather than printing an empty one', () => {
    const md = statsMarkdown(stats({ profiles: [], checks: [], asymmetry: null }));
    expect(md).not.toContain('Median score by kind of site');
    expect(md).not.toContain('What sites fail most');
    expect(md).not.toContain('asymmetry');
    expect(md).toContain('Refusal rate by client');
  });

  it('invents no figure when it has none', () => {
    // llms-full.txt inlines this synchronously and gets the definitions half.
    // It must read as definitions, not as a page of zeroes.
    const md = statsMarkdown(null);
    expect(md).toContain('What each figure counts');
    expect(md).toContain('/stats.md');
    expect(md).not.toMatch(/\b0%/);
  });

  it('carries the page title and description in either form', () => {
    for (const md of [statsMarkdown(null), statsMarkdown(stats())]) {
      expect(md).toContain('# What we have measured');
      expect(md).toContain('Refusal rates by client');
    }
  });
});
