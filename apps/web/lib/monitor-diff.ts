/**
 * What changed between two scans of the same site. Pure, so the alert rule is
 * testable and so the sentence in the email comes from arithmetic rather than
 * from a template someone filled in by hand.
 *
 * Two things are worth waking somebody up for:
 *
 *   a category dropped   the site got measurably worse in one dimension
 *   a new refusal        a client that could read the site last week cannot
 *                        this week, which is the finding the product exists for
 *
 * Everything else is noise at weekly cadence and is not an alert.
 */

import { catalog, type CategoryKey, type CheckResult, type PerAgentFetch } from '@botready/core';

export interface ScanSnapshot {
  scanId: string;
  total: number;
  categoryScores: Record<CategoryKey, number>;
  results: CheckResult[];
  finishedAt: string;
}

export interface MonitorDelta {
  total: number;
  /** Categories that fell, worst first. */
  categoryDrops: Array<{ category: CategoryKey; from: number; to: number }>;
  /** Agent ids that got a 2xx before and a 4xx/5xx/nothing now. */
  newlyRefused: Array<{ id: string; from: number; to: number }>;
  newlyFailed: string[];
}

/** A category has to fall by this much to count. Five points is a check, not jitter. */
const CATEGORY_DROP_THRESHOLD = 5;

export function diff(previous: ScanSnapshot, current: ScanSnapshot): MonitorDelta {
  const categoryDrops = catalog.categories
    .map((c) => ({
      category: c.key,
      from: previous.categoryScores[c.key] ?? 0,
      to: current.categoryScores[c.key] ?? 0,
    }))
    .filter((d) => d.from - d.to >= CATEGORY_DROP_THRESHOLD)
    .sort((a, b) => b.from - b.to - (a.from - a.to));

  const before = perAgent(previous.results);
  const after = perAgent(current.results);
  const newlyRefused = Object.entries(after)
    .filter(([id, now]) => {
      const was = before[id];
      return was && was.status >= 200 && was.status < 300 && !(now.status >= 200 && now.status < 300);
    })
    .map(([id, now]) => ({ id, from: before[id]?.status ?? 0, to: now.status }));

  const failedBefore = new Set(previous.results.filter((r) => r.status === 'fail').map((r) => r.key));
  const newlyFailed = current.results
    .filter((r) => r.status === 'fail' && !failedBefore.has(r.key))
    .map((r) => r.key);

  return { total: current.total - previous.total, categoryDrops, newlyRefused, newlyFailed };
}

export function shouldAlert(delta: MonitorDelta): boolean {
  return delta.categoryDrops.length > 0 || delta.newlyRefused.length > 0;
}

/** The subject line and the body, in the product's voice. */
export function alertCopy(domain: string, delta: MonitorDelta, when: string): { headline: string; detail: string } {
  const date = new Date(when);
  const day = Number.isNaN(date.getTime())
    ? 'this week'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  if (delta.newlyRefused.length > 0) {
    const first = delta.newlyRefused[0];
    const names = delta.newlyRefused.map((r) => agentName(r.id));
    const headline =
      delta.newlyRefused.length === 1 && first
        ? `${agentName(first.id)} started getting ${first.to || 'no reply'} on ${day}`
        : `${delta.newlyRefused.length} clients started being refused on ${day}`;
    const worstDrop = delta.categoryDrops[0];
    const detail = [
      `${list(names)} could read the site last week and ${delta.newlyRefused.length === 1 ? 'cannot' : 'cannot'} now.`,
      worstDrop
        ? `${label(worstDrop.category)} dropped ${worstDrop.from - worstDrop.to} points overnight.`
        : '',
      'Nothing else changed, which usually means a WAF rule was tightened rather than a deploy.',
    ]
      .filter(Boolean)
      .join(' ');
    return { headline, detail };
  }

  const worst = delta.categoryDrops[0];
  if (worst) {
    return {
      headline: `${label(worst.category)} dropped ${worst.from - worst.to} points on ${day}`,
      detail: `From ${worst.from} to ${worst.to}. The total moved ${delta.total >= 0 ? '+' : ''}${delta.total}.${
        delta.newlyFailed.length > 0 ? ` Newly failing: ${delta.newlyFailed.join(', ')}.` : ''
      }`,
    };
  }

  return { headline: `${domain} changed`, detail: `The total moved ${delta.total >= 0 ? '+' : ''}${delta.total}.` };
}

function perAgent(results: CheckResult[]): Record<string, PerAgentFetch> {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  return (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
}

function agentName(id: string): string {
  const ua = catalog.agents.find((a) => a.id === id)?.ua ?? id;
  return ua.split(' ')[0]?.split('/')[0] ?? id;
}

function label(category: CategoryKey): string {
  return catalog.categories.find((c) => c.key === category)?.label ?? category;
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
