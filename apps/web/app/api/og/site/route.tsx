import { pageFor } from '@/lib/content';
import { renderShareCard } from '@/lib/share-card';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * GET /api/og/site?path=/pricing -> the 1200x630 card for a marketing page.
 *
 * A brand card, not a scan card with the score left out. It used to be the
 * latter, and the result was that every marketing link — the homepage most of
 * all — unfurled with a coral tile reading NOT READ, dated with the page's own
 * last content edit. In this product's own vocabulary that is the picture of a
 * site the scanner could not read, so the link that was supposed to introduce
 * botready.dev instead announced that botready.dev had failed.
 *
 * The honest instinct behind the old version was right: there is no score for
 * a page that is not a scan, and inventing one would have been the first
 * dishonest pixel on the site. The mistake was borrowing the failure state to
 * say so. A marketing page has no verdict at all, which is a third thing, and
 * it now looks like a third thing.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '/';
  const page = pageFor(path) ?? pageFor('/')!;

  return renderShareCard({
    variant: 'brand',
    domain: SITE.name,
    checkedAt: '',
    grade: null,
    total: null,
    scoringVersion: null,
    headline: page.title,
    secondary: page.description,
  });
}
