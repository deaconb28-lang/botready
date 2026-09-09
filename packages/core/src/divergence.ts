import { catalog } from './catalog';

/**
 * What each client actually got, and why they differ.
 *
 * This is the product's headline finding and it has been living in a table
 * near the bottom of the result page. A site that returns 200 to Chrome and
 * 403 to ClaudeBot from the same address in the same second is the sentence
 * botready exists to say, and it deserves to be said above the score rather
 * than left for a reader to assemble from five status codes.
 *
 * Ten of the thirty-one general-internet sites that scored in the last sweep
 * treated clients differently. Seven of those ten allow Google-Extended while
 * refusing GPTBot, ClaudeBot and Perplexity — which is a decision somebody
 * made about search traffic, and almost certainly not a decision they made
 * about the other three.
 *
 * Constraint 2: this is derivation, not observation. The scanner records what
 * each client got; this decides what that means, as a pure function over those
 * records, carrying its own version so a verdict can be recomputed when the
 * rules change. Nothing here fetches anything.
 *
 * The classes are separate because the fixes are separate. A 403 from a WAF is
 * a firewall rule; a 403 with `cf-mitigated: challenge` is a bot-management
 * setting one level up from that; a 429 is a rate limit; a 5xx is an origin
 * shedding load; a robots.txt disallow is a line of text. Reporting them all
 * as "blocked" would send everyone to the wrong screen.
 */

export const DIVERGENCE_VERSION = '1.0';

/**
 * Why one client's answer differs, ordered by how the reader should act.
 *
 *   served         a 2xx or 3xx: the page came back
 *   soft_404       404 to this client where the control got a page. Worse than
 *                  a block and almost always unintended — see below
 *   waf_challenge  403 carrying cf-mitigated, so a bot-management product
 *                  decided this, not a firewall rule anybody wrote
 *   waf_403        a plain 401 or 403
 *   rate_limited   429
 *   origin_shed    5xx: the origin gave up rather than refused
 *   unreachable    no response at all
 *   other          a 4xx we have no better name for
 */
export type DivergenceClass =
  | 'served'
  | 'soft_404'
  | 'waf_challenge'
  | 'waf_403'
  | 'rate_limited'
  | 'origin_shed'
  | 'unreachable'
  | 'other';

export interface AgentVerdict {
  agentId: string;
  /** The catalog's short name: "Claude", not "ClaudeBot/1.0". */
  label: string;
  status: number;
  klass: DivergenceClass;
  /** True for the client every other client is compared against. */
  isControl: boolean;
  /**
   * Whether robots.txt names this client and disallows it. Kept apart from
   * `klass` on purpose: robots is advisory and the server may serve a 200
   * anyway, so "robots says no" and "the server said no" are two different
   * facts with two different fixes, and a site can have either without the
   * other.
   */
  robotsDisallowed: boolean;
  /** The value of cf-mitigated, when there was one. */
  mitigated: string;
}

export interface DivergenceVerdict {
  version: string;
  /** Every client, control first, in catalog order after that. */
  agents: AgentVerdict[];
  control: AgentVerdict | null;
  /** Non-control clients that did not get the page. */
  refused: AgentVerdict[];
  /** Non-control clients that did. */
  served: AgentVerdict[];
  /**
   * The finding, or null when there is nothing to report — either every client
   * agreed, or the control never worked and there is no baseline to compare
   * against.
   */
  headline: string | null;
  /**
   * True when the control got the page and at least one agent did not. This is
   * the differential the product is about, as opposed to a site that is simply
   * down or simply refuses everyone.
   */
  differential: boolean;
  /** Clients sent to a 404 that the control could read. Its own alarm. */
  soft404s: AgentVerdict[];
  /** Clients robots.txt disallows, whatever the server did about it. */
  disallowed: AgentVerdict[];
}

export interface DivergenceInput {
  /** From the agent_status_parity check's observed block. */
  perAgent: Record<string, { status: number; cf_mitigated?: string; transport_error?: string }>;
  controlId: string;
  /** From the robots_agent_rules check's observed block. Optional: older scans have none. */
  robotsPerAgent?: Record<string, { allowed: boolean }>;
}

/**
 * One client's class.
 *
 * `controlStatus` is needed for exactly one case, and it is the case worth
 * having: a 404 is only a soft 404 if somebody else got a page. A site that
 * 404s everybody is a broken URL, which is a different and much less
 * interesting finding.
 */
export function classify(
  status: number,
  controlStatus: number,
  opts: { mitigated?: string; transportError?: string } = {},
): DivergenceClass {
  if (opts.transportError || status === 0) return 'unreachable';
  if (status >= 200 && status < 400) return 'served';
  if (status === 404) {
    return controlStatus >= 200 && controlStatus < 400 ? 'soft_404' : 'other';
  }
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'origin_shed';
  if (status === 401 || status === 403) {
    return opts.mitigated ? 'waf_challenge' : 'waf_403';
  }
  return 'other';
}

/** How many, in words, up to the number of clients we have. */
function count(n: number): string {
  return ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][n] ?? String(n);
}

export function divergence(input: DivergenceInput): DivergenceVerdict {
  const defs = catalog.agents;
  const controlStatus = input.perAgent[input.controlId]?.status ?? 0;

  const agents: AgentVerdict[] = defs
    .filter((def) => input.perAgent[def.id])
    .map((def) => {
      const fetched = input.perAgent[def.id];
      const status = fetched?.status ?? 0;
      return {
        agentId: def.id,
        label: def.short,
        status,
        klass: classify(status, controlStatus, {
          mitigated: fetched?.cf_mitigated,
          transportError: fetched?.transport_error,
        }),
        isControl: def.id === input.controlId,
        robotsDisallowed: input.robotsPerAgent?.[def.id]?.allowed === false,
        mitigated: fetched?.cf_mitigated ?? '',
      };
    })
    // Control first: it is the baseline, and a table that reads top to bottom
    // should start with the thing everything else is measured against.
    .sort((a, b) => Number(b.isControl) - Number(a.isControl));

  const control = agents.find((a) => a.isControl) ?? null;
  const others = agents.filter((a) => !a.isControl);
  const refused = others.filter((a) => a.klass !== 'served');
  const served = others.filter((a) => a.klass === 'served');
  const soft404s = others.filter((a) => a.klass === 'soft_404');
  const disallowed = agents.filter((a) => a.robotsDisallowed);

  const controlServed = control?.klass === 'served';
  const differential = Boolean(controlServed) && refused.length > 0;

  return {
    version: DIVERGENCE_VERSION,
    agents,
    control,
    refused,
    served,
    headline: headlineFor({ control, controlServed, others, refused, soft404s, disallowed }),
    differential,
    soft404s,
    disallowed,
  };
}

/**
 * The sentence above the score, or nothing.
 *
 * Nothing is a real answer here and it is returned in three cases: no clients
 * to compare, everybody served, or a control that never worked. The last one
 * matters most. If Chrome did not get the page either, the comparison has no
 * baseline, and "four of four clients were refused" said next to a working
 * browser would be a claim we cannot support — that is retrievability's
 * finding, and the parity check already warns on it.
 */
function headlineFor(v: {
  control: AgentVerdict | null;
  controlServed: boolean;
  others: AgentVerdict[];
  refused: AgentVerdict[];
  soft404s: AgentVerdict[];
  disallowed: AgentVerdict[];
}): string | null {
  if (!v.control || v.others.length === 0) return null;

  if (!v.controlServed) {
    // Everyone refused, control included. Said plainly rather than dressed as
    // a differential, because it is not one.
    return v.refused.length === v.others.length
      ? `Every client we sent was refused, a browser among them.`
      : null;
  }

  if (v.refused.length === 0) {
    // Served but disallowed is still worth a sentence: the server let them in
    // and the robots file asks them not to come.
    if (v.disallowed.length > 0) {
      const n = v.disallowed.length;
      return `${count(n)} of ${count(v.others.length).toLowerCase()} AI clients ${n === 1 ? 'is' : 'are'} served, and asked not to come by your robots.txt.`;
    }
    return null;
  }

  // A soft 404 leads even when it is not the majority: telling a crawler the
  // page does not exist is worse for retrieval than telling it no, and nobody
  // configures it on purpose.
  if (v.soft404s.length > 0) {
    const who = v.soft404s.map((a) => a.label).join(' and ');
    return `${who} ${v.soft404s.length === 1 ? 'is' : 'are'} told this page does not exist. ${v.control.label} is served it.`;
  }

  // Named rather than counted when there is only one other client, because
  // "one of one AI clients" is worse English than saying which one.
  if (v.others.length === 1) {
    return `${v.others[0]?.label} was refused. ${v.control.label} was not.`;
  }

  const n = v.refused.length;
  return `${count(n)} of ${count(v.others.length).toLowerCase()} AI clients ${n === 1 ? 'was' : 'were'} refused. ${v.control.label} was not.`;
}

/** What to do about one class, in one line. Plain, and aimed at the site's owner. */
export const DIVERGENCE_REMEDY: Record<DivergenceClass, string> = {
  served: 'Nothing to do: this client got the page.',
  soft_404:
    'Your edge is answering this client with a 404 rather than the page. That tells it the URL does not exist, which is worse than a refusal — it will stop asking.',
  waf_challenge:
    'A bot-management product challenged this client rather than your firewall refusing it. The setting is usually one switch, separate from your WAF rules.',
  waf_403: 'A rule at your edge refuses this user agent. Allow it, or allow the address ranges its vendor publishes.',
  rate_limited: 'This client hit a rate limit. It will come back less often, and may stop.',
  origin_shed: 'Your origin returned an error to this client rather than refusing it, which usually means load rather than policy.',
  unreachable: 'No response at all for this client. Nothing was measured, so nothing is claimed.',
  other: 'This client got a status the page could not be read from.',
};
