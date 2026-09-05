'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The Product Hunt badge, for launch week.
 *
 * Product Hunt serves this SVG themselves and the URL carries a cache-busting
 * timestamp, so it cannot be vendored — it has to be their request. That is one
 * third-party image and nothing else: no script, no iframe, no tracking pixel,
 * which is what their other embed options are.
 *
 * It removes itself when the request fails, and that is the whole reason this
 * is a client component. `api.producthunt.com` is on the common blocklists, and
 * the people most likely to be running a blocker are the developers this page
 * is written for. Left alone, a blocked badge renders as a broken-image icon
 * and two lines of wrapped alt text directly under the URL box — a worse first
 * impression than no badge at all.
 *
 * **This comes down after launch week.** Delete the component and its one use
 * in app/page.tsx. It is a moment, not a fixture, and a stale "we launched"
 * badge in three months reads as a company that has done nothing since.
 */
export function ProductHuntBadge({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // The tag is server-rendered, so a blocked request can fire its error event
  // before React attaches the handler below. Ask the element on mount rather
  // than leaving a broken-image icon under the URL box.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;

  return (
    <a
      href="https://www.producthunt.com/products/botready-dev?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-botready-dev"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      // The image carries the words, so without this the link is nameless to
      // anything that does not load it.
      aria-label="botready.dev on Product Hunt"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- third-party host with a
          cache-busting query; next/image would proxy and re-encode it for no gain. */}
      <img
        ref={img}
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1241652&theme=light&t=1788568262820"
        alt="botready.dev — Make your website visible to AI | Product Hunt"
        width={250}
        height={54}
        // Width and height are on the tag because the intrinsic size is not
        // known until the response arrives, and a badge that lands late and
        // shoves the page around is worse than one that lands quietly.
        decoding="async"
        onError={() => setFailed(true)}
        className="block h-[54px] w-[250px] max-w-full"
      />
    </a>
  );
}
