import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';

/**
 * Our own robots.txt. Worth getting right for the obvious reason.
 *
 * The live scan page and the API are excluded because they are transient, not
 * because they are secret. Everything a person can read, a crawler can read.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/scan/live', '/app'],
      },
    ],
    sitemap: `${SITE.origin}/sitemap.xml`,
    host: SITE.origin,
  };
}
