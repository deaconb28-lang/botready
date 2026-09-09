import { divergence, type CheckResult, type DivergenceVerdict } from '@botready/core';

/**
 * The divergence verdict, from the evidence a scan already wrote.
 *
 * Two checks hold the pieces. `agent_status_parity` carries what each client
 * got; `robots_agent_rules` carries what robots.txt says about each client.
 * Pulling them out is web-side work because it knows check keys and jsonb
 * shapes, while the rule that turns them into a verdict is pure and lives in
 * core — constraint 2, and the reason a stored verdict can be recomputed when
 * the rule changes.
 *
 * Returns null when the parity check did not run. A scan that was refused at
 * the identity fetch never reaches Pass A, so there is no table to compare and
 * nothing to say; the blocked view says the useful thing in that case.
 */
export function divergenceFor(results: CheckResult[]): DivergenceVerdict | null {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  if (!parity) return null;

  const observed = parity.observed as {
    control?: string;
    per_agent?: Record<string, { status: number; cf_mitigated?: string; transport_error?: string }>;
  };
  const perAgent = observed.per_agent ?? {};
  if (Object.keys(perAgent).length === 0) return null;

  const robots = results.find((r) => r.key === 'robots_agent_rules')?.observed as
    | { per_agent?: Record<string, { allowed: boolean }> }
    | undefined;

  return divergence({
    perAgent,
    controlId: observed.control ?? 'chrome',
    robotsPerAgent: robots?.per_agent,
  });
}
