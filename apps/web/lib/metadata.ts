import type { Metadata } from 'next';

import { markdownPathFor, pageFor } from './content';
import { SITE, absoluteUrl } from './site';

/**
 * The head of a public page, from the one description of it in lib/content.ts.
 *
 * Four things go in here that a page will not remember to do for itself: a
 * canonical, the full Open Graph set (`canonical_og` wants all five, and four
 * out of five is the state most sites are in), the markdown alternate, and an
 * image. They were being written out by hand per page, which is how three
 * pages ended up sharing a description.
 */
export function pageMetadata(path: string, overrides: Metadata = {}): Metadata {
  const page = pageFor(path);
  if (!page) throw new Error(`No public page registered at ${path}. Add it to lib/content.ts.`);

  const url = absoluteUrl(page.path);
  const image = absoluteUrl(`/api/og/site?path=${encodeURIComponent(page.path)}`);

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: page.path,
      types: { 'text/markdown': markdownPathFor(page.path) },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE.name,
      title: page.title,
      description: page.description,
      images: [{ url: image, width: 1200, height: 630, alt: `${page.title} — ${SITE.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [image],
    },
    ...overrides,
  };
}
