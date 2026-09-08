/**
 * Who actually fetched the page.
 *
 * Constraint 7 in one file. The rule that matters is not "does this look like
 * ClaudeBot" — anybody can type that — it is which of four verdicts the
 * evidence supports, and the two failure directions are different mistakes.
 *
 * Counting a fake as real tells a customer the AI crawlers found them when
 * they did not, which is the flattering error and the one the whole category
 * makes. Calling a real crawler a fake sends them to fix a firewall rule that
 * was never wrong. So a disproof has to be an actual disproof, and a missing
 * lookup has to stay a shrug.
 */

import { describe, expect, it } from 'vitest';

import { aiReferrer, claimedAgent, identify, isVerified, KNOWN_AGENTS } from '../src/identity';

const CLAUDE = 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)';
const PERPLEXITY = 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)';
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('what a request claimed to be', () => {
  it('recognises an agent in the catalog', () => {
    expect(claimedAgent(CLAUDE)?.id).toBe('claudebot');
    expect(claimedAgent(PERPLEXITY)?.id).toBe('perplexitybot');
  });

  it('does not mistake a browser for one', () => {
    expect(claimedAgent(CHROME)).toBeNull();
    expect(claimedAgent('')).toBeNull();
  });

  it('prefers the longer pattern, so a sibling cannot swallow a specific one', () => {
    expect(claimedAgent('Mozilla/5.0 (compatible; Perplexity-User/1.0)')?.id).toBe('perplexity-user');
  });

  it('matches whatever case the crawler used', () => {
    expect(claimedAgent('claudebot/1.0')?.id).toBe('claudebot');
  });
});

describe('a claim with no evidence either way', () => {
  it('is unverified, not verified', () => {
    const id = identify(CLAUDE);
    expect(id).toEqual({ agentId: 'claudebot', proof: 'unverified' });
    expect(isVerified(id.proof)).toBe(false);
  });

  it('stays unverified when the published list could not be fetched', () => {
    // A vendor's CDN having a bad afternoon is not evidence of a fake.
    expect(identify(PERPLEXITY, { inPublishedRange: undefined }).proof).toBe('unverified');
  });

  it('is unverified for a request that claimed nothing', () => {
    expect(identify(CHROME)).toEqual({ agentId: null, proof: 'unverified' });
  });
});

describe('proof', () => {
  it('accepts forward-confirmed reverse DNS', () => {
    const id = identify(PERPLEXITY, { rdnsHost: 'crawl-1.perplexity.ai', forwardConfirmed: true });
    expect(id).toEqual({ agentId: 'perplexitybot', proof: 'rdns' });
    expect(isVerified(id.proof)).toBe(true);
  });

  it('accepts a published range where the vendor publishes no rDNS suffix', () => {
    const id = identify(CLAUDE, { inPublishedRange: true });
    expect(id).toEqual({ agentId: 'claudebot', proof: 'ip_range' });
    expect(isVerified(id.proof)).toBe(true);
  });

  it('ignores a trailing dot on the PTR, which is how a resolver returns it', () => {
    expect(identify(PERPLEXITY, { rdnsHost: 'crawl-1.perplexity.ai.', forwardConfirmed: true }).proof).toBe('rdns');
  });
});

describe('disproof', () => {
  it('calls a PTR under the vendor suffix that does not resolve back forged', () => {
    // The whole reason the forward half of FCrDNS exists: anybody can point a
    // PTR wherever they like, and only the forward lookup catches it.
    expect(identify(PERPLEXITY, { rdnsHost: 'crawl-1.perplexity.ai', forwardConfirmed: false }).proof).toBe('forged');
  });

  it('calls a PTR that is somebody else’s forged, when the vendor publishes suffixes', () => {
    expect(identify(PERPLEXITY, { rdnsHost: 'ec2-1-2-3-4.compute.amazonaws.com' }).proof).toBe('forged');
  });

  it('calls an IP outside a published range forged when there is no rDNS to weigh', () => {
    expect(identify(CLAUDE, { inPublishedRange: false }).proof).toBe('forged');
  });

  it('does not call a request forged just for having no PTR', () => {
    expect(identify(PERPLEXITY, { rdnsHost: null }).proof).toBe('unverified');
  });

  it('does not call anything forged for a vendor that publishes neither', () => {
    const ua = 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)';
    expect(identify(ua, { inPublishedRange: false }).proof).toBe('unverified');
  });
});

describe('the catalog', () => {
  it('gives every agent a vendor, a purpose and a pattern', () => {
    for (const a of KNOWN_AGENTS) {
      expect(a.uaPattern.length).toBeGreaterThan(2);
      expect(a.vendor).toBeTruthy();
      expect(['training', 'search', 'on-demand']).toContain(a.purpose);
    }
  });

  it('has no two agents sharing an id', () => {
    const ids = KNOWN_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every agent at least one way to be verified, or admits it has none', () => {
    // Not a failure — Bytespider publishes nothing. The point is that the
    // catalog says so rather than leaving it to be discovered.
    const unverifiable = KNOWN_AGENTS.filter((a) => a.rdnsSuffixes.length === 0 && a.rangeUrls.length === 0);
    expect(unverifiable.map((a) => a.id)).toEqual(['meta-externalagent', 'bytespider', 'ccbot']);
  });
});

describe('where a human came from', () => {
  it('recognises the AI surfaces', () => {
    expect(aiReferrer('https://chatgpt.com/c/abc')?.id).toBe('chatgpt');
    expect(aiReferrer('https://www.perplexity.ai/search/x')?.id).toBe('perplexity');
  });

  it('recognises a subdomain of one', () => {
    expect(aiReferrer('https://chat.openai.com/')?.id).toBe('chatgpt');
  });

  it('returns null for an ordinary referrer', () => {
    expect(aiReferrer('https://news.ycombinator.com/')).toBeNull();
    expect(aiReferrer('')).toBeNull();
  });
});
