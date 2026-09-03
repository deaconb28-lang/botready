/**
 * Pass A. The same URL, once per client, sequential and a second apart.
 *
 * This produces the finding the whole product exists for: a site that answers
 * 200 to Chrome and 403 to ClaudeBot from the same IP within a few seconds.
 * Everything here is an observation. Nothing in this file knows what a point is.
 */

import { catalog, type AgentDef, type CheckResult, type PerAgentFetch } from '@botready/core';

import { crawlSequentially, guardedFetch, type FetchOutcome } from '../fetcher';
import { PAGE_DELAY_MS } from '../version';

export interface ClientProbe {
  agent: AgentDef;
  outcome: FetchOutcome;
}

export interface PassAResult {
  probes: ClientProbe[];
  /** The Chrome control's response, which everything else is compared against. */
  control: ClientProbe;
  results: CheckResult[];
}

/**
 * One fetch per client. The order is fixed with the control first, so that if a
 * site starts rate-limiting us mid-pass the control is the request that got the
 * kindest treatment. That makes the comparison conservative: it can understate
 * a disagreement, never invent one.
 */
export async function runPassA(url: string): Promise<PassAResult> {
  const agents = [...catalog.agents];
  const startedAt = performance.now();

  const outcomes = await crawlSequentially(
    agents.map(() => url),
    PAGE_DELAY_MS,
    async (target, index) => {
      const agent = agents[index];
      if (!agent) throw new Error(`No agent at index ${index}`);
      return {
        agent,
        outcome: await guardedFetch(target, { userAgent: agent.ua }),
      };
    },
  );

  const control = outcomes.find((p) => p.agent.role === 'control');
  if (!control) throw new Error('checks.json defines no control agent');

  const perAgent: Record<string, PerAgentFetch> = {};
  for (const probe of outcomes) {
    perAgent[probe.agent.id] = observe(probe.outcome);
  }

  const parityMs = performance.now() - startedAt;

  return {
    probes: outcomes,
    control,
    results: [
      parityCheck(control, outcomes, perAgent, parityMs),
      latencyCheck(control.outcome),
      redirectCheck(control.outcome),
      cacheHeaderCheck(control.outcome),
    ],
  };
}

/** The raw facts of one response. No interpretation, no verdict. */
function observe(outcome: FetchOutcome): PerAgentFetch {
  return {
    status: outcome.status,
    server: outcome.headers['server'] ?? '',
    // Cloudflare sets this when a request was challenged rather than served.
    // It is the difference between "the site said no" and "a product in front
    // of the site said no", and the remedy is different for each.
    cf_mitigated: outcome.headers['cf-mitigated'] ?? '',
    ttfb_ms: outcome.ttfbMs,
    total_ms: outcome.totalMs,
    bytes: outcome.bytes,
    redirects: outcome.redirects.length,
    content_type: outcome.headers['content-type'] ?? '',
    ...(outcome.transportError ? { transport_error: outcome.transportError } : {}),
  };
}

// ------------------------------------------------------------------ checks

function parityCheck(
  control: ClientProbe,
  probes: ClientProbe[],
  perAgent: Record<string, PerAgentFetch>,
  durationMs: number,
): CheckResult {
  const observed = { control: control.agent.id, per_agent: perAgent };

  // The control has to have worked for the comparison to mean anything. If we
  // could not reach the site as Chrome either, the check errored rather than
  // the site failing it, and the interface says so.
  if (control.outcome.status === 0) {
    return { key: 'agent_status_parity', status: 'error', observed, durationMs };
  }

  const controlClass = klass(control.outcome.status);
  const agents = probes.filter((p) => p.agent.role === 'agent');
  const disagreeing = agents.filter((p) => klass(p.outcome.status) !== controlClass);

  if (disagreeing.length === 0) {
    return { key: 'agent_status_parity', status: 'pass', observed, durationMs };
  }

  // A control that is itself an error means nobody can read the page. That is a
  // real finding but not this check's finding, so it warns rather than failing
  // every agent for a problem they all share.
  if (controlClass !== '2xx') {
    return { key: 'agent_status_parity', status: 'warn', observed, durationMs };
  }

  return { key: 'agent_status_parity', status: 'fail', observed, durationMs };
}

function latencyCheck(outcome: FetchOutcome): CheckResult {
  const observed = {
    ttfb_ms: outcome.ttfbMs,
    total_ms: outcome.totalMs,
    bytes: outcome.bytes,
  };
  if (outcome.status === 0) {
    return { key: 'raw_fetch_latency', status: 'error', observed, durationMs: outcome.totalMs };
  }
  // fails above 2500 ms, per checks.json. Warn from 1200, because a page an
  // agent has to wait a second for is measurably worse without being broken.
  const status =
    outcome.ttfbMs > 2500 ? 'fail' : outcome.ttfbMs > 1200 ? 'warn' : 'pass';
  return { key: 'raw_fetch_latency', status, observed, durationMs: outcome.totalMs };
}

function redirectCheck(outcome: FetchOutcome): CheckResult {
  const observed = {
    hops: outcome.redirects.length,
    chain: outcome.redirects.map((hop) => ({ from: hop.from, to: hop.to, status: hop.status })),
  };
  if (outcome.status === 0 && outcome.redirects.length === 0) {
    return { key: 'redirect_depth', status: 'error', observed, durationMs: outcome.totalMs };
  }
  // fails above 3 hops, per checks.json.
  const status =
    outcome.redirects.length > 3 ? 'fail' : outcome.redirects.length > 1 ? 'warn' : 'pass';
  return { key: 'redirect_depth', status, observed, durationMs: outcome.totalMs };
}

function cacheHeaderCheck(outcome: FetchOutcome): CheckResult {
  const lastModified = outcome.headers['last-modified'] ?? '';
  const etag = outcome.headers['etag'] ?? '';
  const observed = { last_modified: lastModified, etag };

  if (outcome.status === 0) {
    return { key: 'cache_headers', status: 'error', observed, durationMs: outcome.totalMs };
  }
  const status = lastModified || etag ? 'pass' : 'fail';
  return { key: 'cache_headers', status, observed, durationMs: outcome.totalMs };
}

function klass(status: number): string {
  if (status === 0) return 'none';
  return `${Math.floor(status / 100)}xx`;
}
