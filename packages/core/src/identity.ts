import raw from '../agents.json';

/**
 * Who actually fetched the page.
 *
 * Constraint 7: crawler identity is verified, never asserted. A user-agent
 * string is a claim anybody can type, and every log-analytics product in this
 * category reports those claims as crawler counts. A meaningful share of the
 * "ChatGPT traffic" in any real log is a scraper wearing the costume, so
 * reporting it as ChatGPT gives a customer a number that is wrong in the
 * flattering direction — they conclude the AI crawlers found them, and act on
 * it.
 *
 * So every recorded hit carries how its identity was established, and the four
 * verdicts are kept apart on the page as well as in the table:
 *
 *   rdns        forward-confirmed reverse DNS. The PTR resolves to a hostname
 *               under the vendor's suffix, and that hostname resolves back to
 *               the same IP. The gold standard, and the only one that survives
 *               somebody who controls a PTR record they do not own the forward
 *               for — which is exactly the attack the forward half exists to
 *               stop.
 *   ip_range    the IP is inside a range the vendor publishes. Cheaper, and
 *               the fallback where a vendor publishes ranges but no rDNS,
 *               which is most of them.
 *   unverified  claims an agent, no proof either way. Reported separately and
 *               never folded into the verified count.
 *   forged      claims an agent and the vendor's own published evidence says
 *               otherwise. Not an absence of proof — a disproof.
 *
 * Pure. Every lookup happens in the collector; this only judges what came
 * back, so the rule can be tested as a rule.
 */

export type AgentProof = 'rdns' | 'ip_range' | 'unverified' | 'forged';

export interface AgentDefinition {
  id: string;
  label: string;
  vendor: string;
  /** What the fetch is for: training a model, answering now, or a search index. */
  purpose: 'training' | 'search' | 'on-demand';
  /** Matched case-insensitively against the user-agent string. */
  uaPattern: string;
  /** Hostname suffixes a genuine PTR record ends in. Empty when none published. */
  rdnsSuffixes: string[];
  /** Where the vendor publishes its address ranges. Empty when it publishes none. */
  rangeUrls: string[];
}

export interface ReferrerDefinition {
  id: string;
  label: string;
  hosts: string[];
}

interface AgentCatalog {
  agentsVersion: string;
  agents: AgentDefinition[];
  referrers: ReferrerDefinition[];
}

const catalog = raw as AgentCatalog;

export const AGENTS_VERSION = catalog.agentsVersion;
export const KNOWN_AGENTS: readonly AgentDefinition[] = catalog.agents;
export const AI_REFERRERS: readonly ReferrerDefinition[] = catalog.referrers;

export function knownAgent(id: string): AgentDefinition | undefined {
  return catalog.agents.find((a) => a.id === id);
}

/** What a request said it was. Null when it did not claim to be an agent we know. */
export function claimedAgent(userAgent: string): AgentDefinition | null {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return null;
  // Longest pattern first, so "Perplexity-User" is not swallowed by a shorter
  // sibling if one is ever added.
  const byLength = [...catalog.agents].sort((a, b) => b.uaPattern.length - a.uaPattern.length);
  return byLength.find((a) => ua.includes(a.uaPattern.toLowerCase())) ?? null;
}

/** The AI surface a human arrived from, or null. Referrers are hosts, not agents. */
export function aiReferrer(referrer: string): ReferrerDefinition | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    host = referrer.toLowerCase().replace(/^www\./, '');
  }
  if (!host) return null;
  return (
    catalog.referrers.find((r) => r.hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? null
  );
}

export interface Evidence {
  /** The PTR hostname for the IP, or null when there is none or none was fetched. */
  rdnsHost?: string | null;
  /**
   * Whether that hostname resolves back to the same IP. Undefined when the
   * forward half was not attempted — which is not the same as false, and the
   * difference decides between rdns and forged.
   */
  forwardConfirmed?: boolean;
  /**
   * Whether the IP is inside the vendor's published ranges. Undefined when the
   * list could not be fetched, which must degrade to unverified rather than
   * inventing a verdict: a vendor's CDN having a bad afternoon is not evidence
   * that a crawler is a fake.
   */
  inPublishedRange?: boolean;
}

export interface Identity {
  /** The agent this request claimed to be, or null if it claimed nothing we know. */
  agentId: string | null;
  proof: AgentProof;
}

/**
 * Judge one request. Pure; the caller does the DNS and the range lookups.
 *
 * The order matters. Disproof beats proof, because the whole point is to catch
 * a claim that is false; then rDNS, then ranges, then the honest shrug.
 */
export function identify(userAgent: string, evidence: Evidence = {}): Identity {
  const agent = claimedAgent(userAgent);
  if (!agent) return { agentId: null, proof: 'unverified' };

  const { rdnsHost, forwardConfirmed, inPublishedRange } = evidence;
  const host = rdnsHost?.toLowerCase().replace(/\.$/, '') ?? null;
  const suffixes = agent.rdnsSuffixes;
  const matchesSuffix = host !== null && suffixes.some((s) => host.endsWith(s.toLowerCase()));

  // Disproof first.
  //
  // A PTR under the vendor's own suffix that does not resolve back to this IP
  // is not a weaker kind of yes. Anyone can point a PTR at crawl.example, and
  // failing the forward lookup is the single thing that separates a real
  // crawler from somebody who read a blog post about spoofing one.
  if (matchesSuffix && forwardConfirmed === false) return { agentId: agent.id, proof: 'forged' };

  // A PTR that exists, is not the vendor's, and the vendor publishes suffixes:
  // the vendor has said where its crawlers live and this is not there.
  if (host !== null && suffixes.length > 0 && !matchesSuffix) {
    return { agentId: agent.id, proof: 'forged' };
  }

  // In the vendor's published ranges the claim cannot be checked against, an
  // explicit no is a disproof; a missing list is not.
  if (inPublishedRange === false && agent.rangeUrls.length > 0 && host === null) {
    return { agentId: agent.id, proof: 'forged' };
  }

  if (matchesSuffix && forwardConfirmed === true) return { agentId: agent.id, proof: 'rdns' };
  if (inPublishedRange === true) return { agentId: agent.id, proof: 'ip_range' };

  return { agentId: agent.id, proof: 'unverified' };
}

/** Whether a verdict may be counted as the agent it claims to be. */
export function isVerified(proof: AgentProof): boolean {
  return proof === 'rdns' || proof === 'ip_range';
}
