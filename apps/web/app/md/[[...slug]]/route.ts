import { NextResponse } from 'next/server';

import { httpDate, pageFor } from '@/lib/content';
import { markdownFor } from '@/lib/markdown';

/**
 * The markdown representation of a public page.
 *
 * Nobody links here directly. Middleware rewrites `/pricing.md` and any request
 * that asked for `Accept: text/markdown` onto this route, so the readable URL
 * and the negotiated response are the same bytes from the same function.
 */
// Deliberately not prerendered. The handler reads a query parameter that
// middleware sets, and a prerendered route handler is served from the build
// output with the query ignored — which would put a cacheable `cache-control`
// on a negotiated response and let a shared cache serve markdown at /pricing.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await context.params;
  // A client that asked for markdown by header is being answered at the HTML
  // URL, because middleware rewrote it here. That response must not go into a
  // shared cache: the next client to ask for /pricing wants HTML.
  const negotiated = /text\/(x-)?markdown/i.test(request.headers.get('accept') ?? '');
  const path = slug?.length ? `/${slug.join('/')}` : '/';

  const body = markdownFor(path);
  const page = pageFor(path);
  if (!body || !page) {
    return new NextResponse('Not found.\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': httpDate(page.updated),
      'cache-control': negotiated
        ? 'private, no-store'
        : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      vary: 'Accept',
    },
  });
}
