import type { MetadataRoute } from 'next';

import { SEGMENTS, SITE } from '@/lib/site';

/**
 * The static pages. Individual scan results are deliberately absent: there are
 * an unbounded number of them, they are linked from the index pages, and a
 * sitemap that grows without limit is the thing this product complains about.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE.origin}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.origin}/what-we-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE.origin}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.origin}/bot`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE.origin}/sign-in`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    ...SEGMENTS.map((segment) => ({
      url: `${SITE.origin}/index/${segment.key}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ];
}
