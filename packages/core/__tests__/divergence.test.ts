/**
 * The headline finding, tested against the sites it was found on.
 *
 * Every status table below is real, taken from a sweep of fifty
 * general-internet domains. They are the fixtures because a rule about
 * differential treatment should be checked against the differences that
 * actually occur, not against ones convenient to assert.
 *
 * The one to look at twice is patagonia.com. It answers agents with a 404
 * rather than a 403, which reads as a smaller problem and is a larger one: a
 * refusal says "not you", a 404 says "there is nothing here", and a crawler
 * told that stops asking. Nobody configures it deliberately.
 */

import { describe, expect, it } from 'vitest';

import { DIVERGENCE_VERSION, classify, divergence } from '../src/divergence';

/** Observed status tables, control first. */
const OBSERVED = {
  // 200 to Chrome and Google-Extended, 403 to the other three.
  nytimes: { chrome: 200, googleext: 200, claudebot: 403, gptbot: 403, perplexity: 403 },
  // 404 to the agents rather than a refusal.
  patagonia: { chrome: 200, googleext: 200, claudebot: 404, gptbot: 404, perplexity: 404 },
  // One client alone, and a 429 rather than a 403.
  heroku: { chrome: 200, googleext: 200, gptbot: 200, perplexity: 200, claudebot: 429 },
  // The origin shedding rather than refusing.
  amazon: { chrome: 202, googleext: 503, claudebot: 503, gptbot: 503, perplexity: 503 },
  // Refused everybody, control included.
  msf: { chrome: 403, googleext: 403, claudebot: 403, gptbot: 403, perplexity: 403 },
  // Nothing to report.
  clean: { chrome: 200, googleext: 200, claudebot: 200, gptbot: 200, perplexity: 200 },
} as const;

const perAgent = (table: Record<string, number>, extra: Record<string, object> = {}) =>
  Object.fromEntries(
    Object.entries(table).map(([id, status]) => [id, { status, ...(extra[id] ?? {}) }]),
  );

const run = (table: Record<string, number>, extra?: Record<string, object>, robots?: Record<string, { allowed: boolean }>) =>
  divergence({ perAgent: perAgent(table, extra), controlId: 'chrome', robotsPerAgent: robots });

describe('classify', () => {
  it('reads a 2xx or 3xx as served', () => {
    for (const status of [200, 202, 204, 301, 302, 308]) {
      expect(classify(status, 200), String(status)).toBe('served');
    }
  });

  it('separates a challenge from a plain refusal, because the setting is not the same one', () => {
    expect(classify(403, 200)).toBe('waf_403');
    expect(classify(403, 200, { mitigated: 'challenge' })).toBe('waf_challenge');
    expect(classify(401, 200)).toBe('waf_403');
  });

  it('names a rate limit and a shed origin as themselves', () => {
    expect(classify(429, 200)).toBe('rate_limited');
    expect(classify(500, 200)).toBe('origin_shed');
    expect(classify(503, 202)).toBe('origin_shed');
  });

  it('calls a 404 soft only when somebody else got the page', () => {
    // The distinction is the whole finding. A site that 404s everybody has a
    // broken URL; a site that 404s only crawlers is lying to them.
    expect(classify(404, 200)).toBe('soft_404');
    expect(classify(404, 404)).toBe('other');
    expect(classify(404, 403)).toBe('other');
  });

  it('treats no response as measured nothing', () => {
    expect(classify(0, 200)).toBe('unreachable');
    expect(classify(200, 200, { transportError: 'socket hang up' })).toBe('unreachable');
  });
});

describe('the verdict', () => {
  it('carries its own version, so a stored one can be recomputed', () => {
    expect(run(OBSERVED.nytimes).version).toBe(DIVERGENCE_VERSION);
  });

  it('puts the control first, because everything else is measured against it', () => {
    const v = run(OBSERVED.nytimes);
    expect(v.agents[0]?.isControl).toBe(true);
    expect(v.agents[0]?.agentId).toBe('chrome');
    expect(v.agents).toHaveLength(5);
  });

  it('states the differential in one sentence', () => {
    const v = run(OBSERVED.nytimes);
    expect(v.differential).toBe(true);
    expect(v.refused.map((a) => a.agentId).sort()).toEqual(['claudebot', 'gptbot', 'perplexity']);
    expect(v.served.map((a) => a.agentId)).toEqual(['googleext']);
    expect(v.headline).toBe('Three of four AI clients were refused. Chrome was not.');
  });

  it('leads with a soft 404 even though it is not the majority finding', () => {
    const v = run(OBSERVED.patagonia);
    expect(v.soft404s).toHaveLength(3);
    expect(v.headline).toContain('does not exist');
    expect(v.headline).toContain('Chrome is served it');
  });

  it('reports one refused client as one, not as a proportion of nothing', () => {
    const v = run(OBSERVED.heroku);
    expect(v.refused.map((a) => a.agentId)).toEqual(['claudebot']);
    expect(v.refused[0]?.klass).toBe('rate_limited');
    expect(v.headline).toBe('One of four AI clients was refused. Chrome was not.');
  });

  it('classifies a shed origin without calling it a refusal by the site', () => {
    const v = run(OBSERVED.amazon);
    expect(v.control?.klass).toBe('served'); // 202
    expect(v.refused.every((a) => a.klass === 'origin_shed')).toBe(true);
    expect(v.differential).toBe(true);
  });

  /**
   * The case the parity check gets wrong if the order is wrong, and the case
   * this headline must not dress up as a differential.
   */
  it('says plainly when everyone was refused, and claims no differential', () => {
    const v = run(OBSERVED.msf);
    expect(v.differential).toBe(false);
    expect(v.headline).toBe('Every client we sent was refused, a browser among them.');
  });

  it('says nothing when every client got the page', () => {
    const v = run(OBSERVED.clean);
    expect(v.differential).toBe(false);
    expect(v.refused).toHaveLength(0);
    expect(v.headline).toBeNull();
  });

  it('says nothing when there is no baseline to compare against', () => {
    // Control unreachable. Four agents refused is not a finding about
    // differential treatment when we never established what a browser gets.
    const v = run({ chrome: 0, claudebot: 403, gptbot: 403, perplexity: 403, googleext: 200 });
    expect(v.control?.klass).toBe('unreachable');
    expect(v.differential).toBe(false);
    expect(v.headline).toBeNull();
  });

  it('picks up cf-mitigated so the reader is sent to the right setting', () => {
    const v = run(OBSERVED.nytimes, { claudebot: { cf_mitigated: 'challenge' } });
    const claude = v.agents.find((a) => a.agentId === 'claudebot');
    expect(claude?.klass).toBe('waf_challenge');
    expect(claude?.mitigated).toBe('challenge');
    // The others keep the plainer class.
    expect(v.agents.find((a) => a.agentId === 'gptbot')?.klass).toBe('waf_403');
  });

  it('keeps a robots disallow apart from what the server did', () => {
    // Served a 200 and asked not to come. Two facts, two fixes, and a site can
    // have either without the other.
    const v = run(OBSERVED.clean, {}, { gptbot: { allowed: false }, claudebot: { allowed: true } });
    expect(v.disallowed.map((a) => a.agentId)).toEqual(['gptbot']);
    expect(v.agents.find((a) => a.agentId === 'gptbot')?.klass).toBe('served');
    expect(v.headline).toContain('robots.txt');
  });

  it('ignores a client the scan has no record of', () => {
    const v = divergence({ perAgent: { chrome: { status: 200 }, gptbot: { status: 403 } }, controlId: 'chrome' });
    expect(v.agents).toHaveLength(2);
    // Named rather than counted: "one of one AI clients" is worse English
    // than saying which client it was.
    expect(v.headline).toBe('GPT was refused. Chrome was not.');
  });

  it('returns nothing rather than throwing on an empty scan', () => {
    const v = divergence({ perAgent: {}, controlId: 'chrome' });
    expect(v.control).toBeNull();
    expect(v.headline).toBeNull();
    expect(v.differential).toBe(false);
  });
});
