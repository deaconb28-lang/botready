import { pageFor } from '@/lib/content';
import { formatCardDate, renderShareCard } from '@/lib/share-card';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * GET /api/og/site?path=/pricing -> the 1200x630 card for a marketing page.
 *
 * The same card the result pages use, with the grade tile empty: there is no
 * score to show for a page that is not a scan, and inventing one to fill the
 * space would be the first dishonest pixel on the site.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '/';
  const page = pageFor(path) ?? pageFor('/')!;

  return renderShareCard({
    domain: SITE.name,
    checkedAt: formatCardDate(`${page.updated}T00:00:00Z`),
    grade: null,
    total: null,
    scoringVersion: null,
    headline: page.title,
    secondary: page.description,
  });
}
