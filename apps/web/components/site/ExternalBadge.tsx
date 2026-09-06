'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A directory's badge, served by the directory.
 *
 * Every one of these is the same shape — their image, our link, and a real
 * chance the request never lands — so the shape lives here once rather than
 * being written out again per directory.
 *
 * The failure handling is the reason it is a client component. Badge hosts turn
 * up on the common blocklists, and the people most likely to be running a
 * blocker are the developers this site is written for. Left alone, a blocked
 * badge renders as a broken-image icon and two lines of wrapped alt text, which
 * is a worse first impression than no badge at all.
 *
 * Width and height are required rather than optional: the intrinsic size is not
 * known until the response arrives, and a badge that lands late and shoves the
 * page around is worse than one that lands quietly.
 */
export function ExternalBadge({
  href,
  src,
  alt,
  label,
  width,
  height,
  className = '',
}: {
  href: string;
  src: string;
  alt: string;
  /** The link's accessible name. The image carries the words, so without this
      the link is nameless to anything that does not load it. */
  label: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // The tag is server-rendered, so a blocked request can fire its error event
  // before React attaches the handler below. Ask the element on mount rather
  // than leaving a broken-image icon on the page.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a third-party host
          serves these; next/image would proxy and re-encode for no gain. */}
      <img
        ref={img}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width, height }}
        className="block max-w-full"
      />
    </a>
  );
}
