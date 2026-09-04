import { NextResponse } from 'next/server';

import { httpDate, newestUpdate } from '@/lib/content';
import { llmsTxt } from '@/lib/markdown';

/**
 * llms.txt, generated from the same page list as the sitemap. Every link in it
 * is a URL this site serves, which is the property the check is really about:
 * a file full of dead links costs a client its budget and teaches it not to
 * trust the convention.
 */
export const dynamic = 'force-static';

export function GET() {
  return new NextResponse(llmsTxt(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': httpDate(newestUpdate()),
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
