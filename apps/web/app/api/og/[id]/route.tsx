import { loadScanView } from '@/lib/scan-data';
import { cardCopy, formatCardDate, renderShareCard } from '@/lib/share-card';

export const runtime = 'nodejs';

/**
 * GET /api/og/:id -> a 1200x630 PNG.
 *
 * Everything about how the card looks lives in lib/share-card.tsx. This route
 * only turns a scan into the handful of facts that card needs.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const view = await loadScanView(id);

  if (!view) {
    return new Response('No scan with that id.', { status: 404 });
  }

  const { site, score, scan, results, findings } = view;

  const parity = results.find((r) => r.key === 'agent_status_parity');
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');

  const copy = score
    ? cardCopy({
        perAgent: (parity?.observed.per_agent ?? {}) as Record<string, { status: number }>,
        controlId: String(parity?.observed.control ?? 'chrome'),
        findings,
        ratio: ratio ? { value: Number(ratio.observed.ratio ?? 0), status: ratio.status } : null,
        checksTotal: results.length,
      })
    : {
        headline:
          scan.status === 'blocked'
            ? 'This site refuses our scanner.'
            : 'The scan could not finish.',
        secondary: scan.error_message ?? '',
      };

  return renderShareCard({
    domain: site.domain,
    checkedAt: formatCardDate(scan.finished_at ?? scan.created_at),
    grade: score?.grade ?? null,
    total: score?.total ?? null,
    scoringVersion: score?.scoringVersion ?? null,
    headline: copy.headline,
    secondary: copy.secondary,
  });
}
