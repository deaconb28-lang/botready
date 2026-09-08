/**
 * Share of voice, as a rule.
 *
 * This is the answer plane's scoring function, so it gets the same treatment:
 * the arithmetic is the product, and the interesting cases are the ones where
 * a plausible implementation would quietly say something untrue.
 */

import { describe, expect, it } from 'vitest';

import { VISIBILITY_VERSION, visibility, visibilityOver, type RunObservation } from '../src/visibility';

const run = (cited: string[], over: Partial<RunObservation> = {}): RunObservation => ({
  promptId: 'p1',
  engineId: 'claude',
  citedDomains: cited,
  ...over,
});

const IN = { self: 'linear.app', rivals: ['asana.com', 'height.app'] };

describe('the basics', () => {
  it('counts an answer that cited us', () => {
    const v = visibility({ ...IN, runs: [run(['linear.app', 'asana.com'])] });
    expect(v.citations).toBe(1);
    expect(v.mentionRate).toBe(100);
    expect(v.shareOfVoice).toBe(50);
  });

  it('records the version it was computed under', () => {
    expect(visibility({ ...IN, runs: [] }).visibilityVersion).toBe(VISIBILITY_VERSION);
  });

  it('names the engines that contributed, so a number is never quietly one engine’s', () => {
    const runs = [run(['linear.app']), run(['linear.app'], { engineId: 'chatgpt' })];
    expect(visibility({ ...IN, runs }).engines).toEqual(['chatgpt', 'claude']);
  });

  it('reports zero without pretending it measured anything', () => {
    const v = visibility({ ...IN, runs: [] });
    expect(v).toMatchObject({ runs: 0, answered: 0, citations: 0, mentionRate: 0, shareOfVoice: 0 });
    expect(v.averagePosition).toBeNull();
  });
});

describe('a run that produced no answer', () => {
  // The reading nobody could act on: an API outage that looks like a collapse
  // in visibility. A refusal is excluded from both halves of every rate.
  it('is not counted as an answer that failed to cite us', () => {
    const runs = [run(['linear.app']), run([], { error: '529 overloaded' })];
    const v = visibility({ ...IN, runs });
    expect(v.runs).toBe(2);
    expect(v.answered).toBe(1);
    expect(v.mentionRate).toBe(100);
  });

  it('leaves share of voice alone entirely', () => {
    const clean = visibility({ ...IN, runs: [run(['linear.app', 'asana.com'])] });
    const noisy = visibility({ ...IN, runs: [run(['linear.app', 'asana.com']), run([], { error: 'refused' })] });
    expect(noisy.shareOfVoice).toBe(clean.shareOfVoice);
  });
});

describe('the denominator', () => {
  it('is the tracked set, not every domain that happened to appear', () => {
    // Wikipedia and a review site in the answer must not dilute the category.
    const v = visibility({
      ...IN,
      runs: [run(['linear.app', 'wikipedia.org', 'g2.com', 'asana.com'])],
    });
    expect(v.shareOfVoice).toBe(50);
  });

  it('is 100% when nobody but us is tracked and we were cited', () => {
    const v = visibility({ self: 'linear.app', rivals: [], runs: [run(['linear.app', 'g2.com'])] });
    expect(v.shareOfVoice).toBe(100);
  });

  it('is zero, not NaN, when no tracked domain was cited at all', () => {
    const v = visibility({ ...IN, runs: [run(['wikipedia.org'])] });
    expect(v.shareOfVoice).toBe(0);
    expect(v.mentionRate).toBe(0);
  });
});

describe('what counts as the same site', () => {
  it('folds a subdomain into its root', () => {
    const v = visibility({ ...IN, runs: [run(['docs.linear.app'])] });
    expect(v.citations).toBe(1);
  });

  it('ignores www and case', () => {
    const v = visibility({ ...IN, runs: [run(['WWW.Linear.App'])] });
    expect(v.citations).toBe(1);
  });

  it('counts one answer once however many times it names us', () => {
    const v = visibility({ ...IN, runs: [run(['linear.app', 'docs.linear.app', 'linear.app/pricing'])] });
    expect(v.citations).toBe(1);
    expect(v.shareOfVoice).toBe(100);
  });

  it('drops a rival that is the customer under another spelling', () => {
    const v = visibility({ self: 'linear.app', rivals: ['www.linear.app'], runs: [run(['linear.app'])] });
    expect(v.rivals).toEqual([]);
  });
});

describe('position', () => {
  it('is 1-based and averaged over the answers that cited us', () => {
    const runs = [run(['asana.com', 'linear.app']), run(['linear.app'])];
    expect(visibility({ ...IN, runs }).averagePosition).toBe(1.5);
  });

  it('is null when we were never cited, rather than a flattering zero', () => {
    expect(visibility({ ...IN, runs: [run(['asana.com'])] }).averagePosition).toBeNull();
  });

  it('is measured over the whole citation list, not just the tracked part', () => {
    // Third overall, even though the two above are untracked. Anything else
    // would report a rank the reader cannot see in the answer.
    const v = visibility({ ...IN, runs: [run(['g2.com', 'wikipedia.org', 'linear.app'])] });
    expect(v.averagePosition).toBe(3);
  });
});

describe('rivals', () => {
  it('are ordered by citations, best first', () => {
    const runs = [run(['asana.com']), run(['asana.com']), run(['height.app'])];
    const v = visibility({ ...IN, runs });
    expect(v.rivals.map((r) => r.domain)).toEqual(['asana.com', 'height.app']);
    expect(v.rivals[0]?.citations).toBe(2);
  });

  it('are listed even when never cited, because absent is a result', () => {
    const v = visibility({ ...IN, runs: [run(['linear.app'])] });
    expect(v.rivals).toHaveLength(2);
    expect(v.rivals.every((r) => r.citations === 0)).toBe(true);
  });

  it('share out to 100 with us when only tracked domains were cited', () => {
    const runs = [run(['linear.app']), run(['asana.com']), run(['height.app']), run(['asana.com'])];
    const v = visibility({ ...IN, runs });
    const total = v.shareOfVoice + v.rivals.reduce((s, r) => s + r.shareOfVoice, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});

describe('over time', () => {
  it('measures each window independently and keeps its label', () => {
    const out = visibilityOver(IN, [
      { label: 'week 1', runs: [run(['asana.com'])] },
      { label: 'week 2', runs: [run(['linear.app'])] },
    ]);
    expect(out.map((w) => w.label)).toEqual(['week 1', 'week 2']);
    expect(out[0]?.shareOfVoice).toBe(0);
    expect(out[1]?.shareOfVoice).toBe(100);
  });

  it('returns nothing for no windows', () => {
    expect(visibilityOver(IN, [])).toEqual([]);
  });
});

describe('the engine catalog is data', () => {
  it('declares the engines we do not ask yet, so adding one is a JSON edit', async () => {
    const { ENGINES, LIVE_ENGINES, engineDef, cycleCostUsd } = await import('../src/engines');
    expect(ENGINES.length).toBeGreaterThan(LIVE_ENGINES.length);
    expect(LIVE_ENGINES.map((e) => e.id)).toEqual(['claude']);
    expect(engineDef('claude')?.keyEnv).toBe('ANTHROPIC_API_KEY');
  });

  it('prices a cycle, because cadence is priced and this is the input', async () => {
    const { cycleCostUsd } = await import('../src/engines');
    // The agency tier: 50 questions, weekly, one engine. Roughly $6.50 a month
    // against $29, which is the margin the tier was set from.
    const weekly = cycleCostUsd(50, ['claude']);
    expect(Math.round(weekly * 4.33 * 100) / 100).toBeLessThan(29 * 0.35);
  });

  it('every engine names the variable its key lives in', async () => {
    const { ENGINES } = await import('../src/engines');
    expect(ENGINES.every((e) => /^[A-Z0-9_]+$/.test(e.keyEnv))).toBe(true);
  });
});
