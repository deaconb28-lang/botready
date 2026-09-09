/**
 * Pass A. The same URL, once per client, sequential and a second apart.
 *
 * This produces the finding the whole product exists for: a site that answers
 * 200 to Chrome and 403 to ClaudeBot from the same IP within a few seconds.
 * Everything here is an observation. Nothing in this file knows what a point is.
 */

import { catalog, type AgentDef, type CheckResult, type CheckStatus, type PerAgentFetch } from '@botready/core';

import { crawlSequentially, guardedFetch, type FetchOutcome } from '../fetcher';
import { CLIENT_PROBE_TIMEOUT_MS, PAGE_DELAY_MS } from '../version';

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
        outcome: await guardedFetch(target, { userAgent: agent.ua, timeoutMs: CLIENT_PROBE_TIMEOUT_MS }),
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

  const agents = probes.filter((p) => p.agent.role === 'agent');
  const status = parityStatus(
    control.outcome.status,
    agents.map((p) => p.outcome.status),
  );
  return { key: 'agent_status_parity', status, observed, durationMs };
}

/**
 * The parity rule, with no fetch in it.
 *
 * Pure and exported so the rule is tested as a rule rather than through a
 * fixture server, which is how the one bug it has had went unnoticed: the
 * agreement test sat above the control test, so a site answering 403 to all
 * five clients had no disagreement, took the early return, and scored full
 * points for perfect parity. doctorswithoutborders.org did exactly that — 403
 * from every client including the Chrome control — and came out a B 71.
 *
 * Uniform refusal is agreement in the arithmetic and the opposite of what this
 * check exists to reward, so the order matters and is now fixed by a test.
 *
 *   control unreachable   error — our problem, not a finding about the site
 *   control refused       warn  — nobody can read it, but that is not this
 *                                 check's finding, and failing four agents for
 *                                 a wall they all hit would blame them for it
 *   all agree with 2xx    pass
 *   any disagreement      fail  — the headline the product exists for
 */
export function parityStatus(controlStatus: number, agentStatuses: readonly number[]): CheckStatus {
  if (controlStatus === 0) return 'error';
  const controlClass = klass(controlStatus);
  if (controlClass !== '2xx') return 'warn';
  return agentStatuses.every((s) => klass(s) === controlClass) ? 'pass' : 'fail';
}

/**
 * Whether the control's response describes the site at all.
 *
 * The three checks below read latency, redirects and cache headers off the
 * control response, which is only the site's response when the site actually
 * answered. A 403 from a WAF has its own time to first byte, its own redirect
 * count and no ETag, and reporting those as the site's would be three false
 * findings about a page we never saw.
 *
 * They skip rather than error in that case. Error is zero points inside the
 * denominator, which would dock a site for a wall its WAF put in front of us;
 * skip leaves the denominator, which is what "we could not measure this"
 * honestly costs.
 *
 * A 3xx counts as answering, and the difference from parityStatus above —
 * which demands a strict 2xx — is deliberate rather than an oversight. The
 * fetcher follows redirects, so a 3xx here is the final status after the hop
 * cap was hit: the site was talking to us and redirect_depth is about to fail
 * it for exactly that, which is the right finding in the right place. Parity
 * is stricter because a redirect-capped control is not a usable baseline to
 * compare four other clients against.
 */
function measuredTheSite(outcome: FetchOutcome): boolean {
  return outcome.status >= 200 && outcome.status < 400;
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
  // How fast a block page came back is not how fast the site is.
  if (!measuredTheSite(outcome)) {
    return { key: 'raw_fetch_latency', status: 'skip', observed, durationMs: outcome.totalMs };
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
  // A refused request's hop count is the WAF's chain, not the site's. Judged
  // on the final status rather than on status 0, so a 403 after two hops is
  // not scored as a clean two-hop site.
  if (!measuredTheSite(outcome)) {
    return { key: 'redirect_depth', status: 'skip', observed, durationMs: outcome.totalMs };
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
  // A block page has no ETag, and failing the site for that would be a
  // finding about somebody else's error page.
  if (!measuredTheSite(outcome)) {
    return { key: 'cache_headers', status: 'skip', observed, durationMs: outcome.totalMs };
  }
  const status = lastModified || etag ? 'pass' : 'fail';
  return { key: 'cache_headers', status, observed, durationMs: outcome.totalMs };
}

function klass(status: number): string {
  if (status === 0) return 'none';
  return `${Math.floor(status / 100)}xx`;
}
