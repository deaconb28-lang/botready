import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // packages/core ships TypeScript source rather than a build step, so that the
  // worker, the web app and the tests all read the same files.
  transpilePackages: ['@botready/core'],
  poweredByHeader: false,
  // The share card reads its two TTFs off disk. Without this they are not part
  // of the deployed bundle and the card silently falls back to a default face.
  outputFileTracingIncludes: {
    '/api/og/[id]': ['./assets/fonts/**'],
  },
  // The public URL of the ranking is /index/[segment], as the plan says. The
  // route lives in app/ranking/ because a route segment literally named
  // `index` collides with Next's own index.html convention: the prerendered
  // pages land in .next/server/app/index/index/*.html and Vercel's builder,
  // looking in app/index/*.html, fails the deploy with ENOENT. The rewrite
  // keeps the URL and the redirect keeps it the only one.
  async rewrites() {
    return [{ source: '/index/:segment', destination: '/ranking/:segment' }];
  },
  async redirects() {
    return [{ source: '/ranking/:segment', destination: '/index/:segment', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
          // .dev is HSTS preloaded, so this is a restatement rather than a
          // requirement. Kept explicit so a staging host on another TLD behaves.
          {
            key: 'strict-transport-security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
