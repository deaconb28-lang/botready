import { NextResponse } from 'next/server';

import { httpDate, newestUpdate } from '@/lib/content';
import { llmsFullTxt } from '@/lib/markdown';

/** Every public page inlined, so reading the whole site costs one request. */
export const dynamic = 'force-static';

export function GET() {
  return new NextResponse(llmsFullTxt(), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': httpDate(newestUpdate()),
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
