import { pageFor } from '@/lib/content';
import { renderBrandCard } from '@/lib/share-card';

export const runtime = 'nodejs';

/**
 * GET /api/og/site?path=/pricing -> the 1200x630 card for a marketing page.
 *
 * The homepage's hero, at card size. It used to be the scan card with the
 * score left out, which rendered a coral NOT READ tile dated with the page's
 * last content edit — see renderBrandCard for why that happened and why a page
 * with no verdict now gets no verdict-shaped hole.
 *
 * Only the headline varies. The rest of the card is the same invitation on
 * every page, because the card's job is the same on every page: somebody who
 * has never heard of this is looking at a link, and what they need is the
 * question and the box.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '/';
  const page = pageFor(path) ?? pageFor('/')!;

  return renderBrandCard({ headline: page.title });
}
