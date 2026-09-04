import { NextResponse, type NextRequest } from 'next/server';

import { httpDate, markdownPathFor, pageFor } from './lib/content';

/**
 * Three things a page cannot do for itself.
 *
 * 1. Answer `Accept: text/markdown` with markdown. A client that wants the
 *    words should not have to run a browser and then strip tags to get them.
 * 2. Advertise that alternative in a `Link` header, so a client that only reads
 *    headers finds it without parsing the body.
 * 3. Carry `Last-Modified`. Next does not send one for an app-router page, and
 *    without it a conditional request is impossible: every revisit is a full
 *    download of a page that has not changed since August.
 *
 * The date is the page's own content date from lib/content.ts, not the deploy
 * time. Stamping the build on every page is exactly what `sitemap_lastmod_real`
 * fails sites for.
 */

/** Whether this client would rather have markdown than HTML. */
function prefersMarkdown(accept: string): boolean {
  if (!accept) return false;
  let markdown = -1;
  let html = -1;
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().split(';');
    const q = params
      .map((p) => /^\s*q\s*=\s*([0-9.]+)/i.exec(p)?.[1])
      .find(Boolean);
    const weight = q === undefined ? 1 : Number(q);
    if (!Number.isFinite(weight)) continue;
    const name = (type ?? '').trim().toLowerCase();
    if (name === 'text/markdown' || name === 'text/x-markdown') markdown = Math.max(markdown, weight);
    if (name === 'text/html' || name === 'application/xhtml+xml') html = Math.max(html, weight);
  }
  return markdown > 0 && markdown >= html;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const page = pageFor(pathname);
  if (!page) return NextResponse.next();

  const markdownUrl = new URL(request.nextUrl);
  markdownUrl.pathname = pathname === '/' ? '/md' : `/md${pathname}`;

  const headers = new Headers({
    link: `<${markdownPathFor(page.path)}>; rel="alternate"; type="text/markdown"`,
    'last-modified': httpDate(page.updated),
    vary: 'Accept',
  });

  if (prefersMarkdown(request.headers.get('accept') ?? '')) {
    return NextResponse.rewrite(markdownUrl, { headers });
  }
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ['/', '/what-we-check', '/pricing', '/docs', '/bot', '/sign-in'],
};
