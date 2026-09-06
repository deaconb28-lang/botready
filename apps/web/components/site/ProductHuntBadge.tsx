import { ExternalBadge } from './ExternalBadge';

/**
 * The Product Hunt badge, for launch week.
 *
 * Their SVG, from their host, with a cache-busting timestamp in the URL — so
 * unlike the Twelve Tools badge this one could never have been vendored even if
 * we wanted to. One third-party image and nothing else: no script, no iframe,
 * no tracking pixel, which is what their other embed options are.
 *
 * It sits in the footer, so it is on every page rather than only the home page,
 * and it is nowhere near the URL box — which is the one thing the home page is
 * for and the one thing nothing gets to push down.
 *
 * **This comes down after launch week.** Delete the component and its one use
 * in components/site/SiteFooter.tsx. It is a moment, not a fixture, and a
 * stale "we launched" badge in three months reads as a company that has done
 * nothing since.
 */
export function ProductHuntBadge({ className = '' }: { className?: string }) {
  return (
    <ExternalBadge
      href="https://www.producthunt.com/products/botready-dev?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-botready-dev"
      src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1241652&theme=light&t=1788568262820"
      alt="botready.dev — Make your website visible to AI | Product Hunt"
      label="botready.dev on Product Hunt"
      width={250}
      height={54}
      className={className}
    />
  );
}
