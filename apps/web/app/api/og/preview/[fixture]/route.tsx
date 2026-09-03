import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { findings, scoreDetail, type CheckResult } from '@botready/core';

import { isProduction } from '@/lib/env';
import { cardCopy, formatCardDate, renderShareCard } from '@/lib/share-card';

export const runtime = 'nodejs';

/**
 * The share card, from a fixture. Not available in production.
 *
 * A card only ever appears inside somebody else's link unfurler, which makes it
 * the hardest thing in the product to actually look at while building it. This
 * route renders the identical image from a fixture so it can be opened in a
 * browser and checked.
 */
export async function GET(_request: Request, context: { params: Promise<{ fixture: string }> }) {
  if (isProduction()) return new Response('Not found.', { status: 404 });

  const { fixture } = await context.params;
  if (!/^[a-z0-9-]+$/.test(fixture)) return new Response('Bad fixture name.', { status: 400 });

  let results: CheckResult[];
  try {
    const path = join(process.cwd(), '..', '..', 'packages', 'core', '__fixtures__', `${fixture}.json`);
    results = JSON.parse(await readFile(path, 'utf8')) as CheckResult[];
  } catch {
    return new Response(`No fixture called ${fixture}.`, { status: 404 });
  }

  const score = scoreDetail(results);
  const list = findings(results);
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');

  const copy = cardCopy({
    perAgent: (parity?.observed.per_agent ?? {}) as Record<string, { status: number }>,
    controlId: String(parity?.observed.control ?? 'chrome'),
    findings: list,
    ratio: ratio ? { value: Number(ratio.observed.ratio ?? 0), status: ratio.status } : null,
    checksTotal: results.length,
  });

  return renderShareCard({
    domain: 'linear.app',
    checkedAt: formatCardDate('2026-09-02T14:02:00Z'),
    grade: score.grade,
    total: score.total,
    scoringVersion: score.scoringVersion,
    headline: copy.headline,
    secondary: copy.secondary,
  });
}
