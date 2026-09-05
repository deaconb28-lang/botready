import type { MetadataRoute } from 'next';

import { PUBLIC_PAGES } from '@/lib/content';
import { PUBLIC_INDEX_LISTED, SEGMENTS, SITE } from '@/lib/site';

/**
 * The static pages, with the date each one's content actually changed.
 *
 * Individual scan results are deliberately absent: there are an unbounded
 * number of them, they are linked from the index pages, and a sitemap that
 * grows without limit is one of the things this product complains about.
 *
 * The dates come from lib/content.ts rather than `new Date()`. A sitemap where
 * every `lastmod` is the deploy timestamp tells a crawler nothing except when
 * we last shipped, and `sitemap_lastmod_real` fails sites for it — including,
 * until now, this one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const listed = PUBLIC_PAGES.filter((page) => page.listed);
  const indexUpdated = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return [
    ...listed.map((page) => ({
      url: `${SITE.origin}${page.path === '/' ? '/' : page.path}`,
      lastModified: new Date(`${page.updated}T00:00:00Z`),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    // The ranking pages are rebuilt nightly, so yesterday is the honest answer
    // and today would be a claim we cannot make until tonight's run. Left out
    // entirely while the index is unlisted: a sitemap is where we say what is
    // worth reading, and a ranking of too few sites is not.
    ...(PUBLIC_INDEX_LISTED ? SEGMENTS : []).map((segment) => ({
      url: `${SITE.origin}/index/${segment.key}`,
      lastModified: indexUpdated,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ];
}
