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
        // The share card lives under /api/, and a social crawler that obeys the
        // disallow below would otherwise skip the one thing it came for.
        allow: ['/', '/api/og/'],
        // The app and the account area are a person's own workspace, and the
        // preview routes render fixtures rather than measurements. Everything
        // else a person can read, a crawler can read.
        disallow: ['/api/', '/scan/live', '/app', '/account', '/claim', '/preview'],
      },
    ],
    sitemap: `${SITE.origin}/sitemap.xml`,
    host: SITE.origin,
  };
}
