'use client';

import { useEffect, useRef, useState } from 'react';

import { cx } from '@/components/ui';

/**
 * The scanned site's own icon, with its initial underneath.
 *
 * Requests are made by the reader's browser to the scanned site's own origin.
 * No favicon service: those work by being told every domain anyone looks up,
 * and a tool that measures who a site lets read it should not hand a third
 * party the list of sites its users are curious about.
 *
 * `candidates` is walked in order and the first one that decodes wins, because
 * one guess is not enough. /favicon.ico is a convention, not a rule:
 * betterpomo.com declares /Icon_light.png and answers /favicon.ico with a 404
 * page, and a single guess there leaves every reader looking at a letter.
 *
 * The letter is not a spinner. It is what is shown once the list runs out, so
 * the tile is never empty and never changes size.
 */
export function SiteFavicon({
  candidates,
  domain,
  size = 22,
  className = '',
}: {
  candidates: string[];
  domain: string;
  size?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  const monogram = (domain.replace(/^www\./, '')[0] ?? '?').toUpperCase();
  const src = candidates[index];

  // The <img> is server-rendered, so a fast 404 can fire its error event before
  // React has hydrated and attached the handler below — and then the tile keeps
  // the browser's broken-image glyph forever. Asking the element directly after
  // each paint catches a failure that has already happened.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setIndex((i) => i + 1);
  }, [index]);

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cx('grid shrink-0 place-items-center rounded-[6px] border-2 border-ink bg-violet font-mono font-bold text-white', className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {monogram}
      </span>
    );
  }

  return (
    /* An arbitrary third-party origin: next/image would proxy every scanned
       site's icon through our own image pipeline. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // Keyed by src so a failed candidate is torn down rather than reused,
      // which is what makes `complete` above mean this candidate.
      key={src}
      ref={img}
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
      className={cx('shrink-0 rounded-[5px] object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** The conventional icon paths on a site's own origin, best first. */
export function fallbackIcons(url: string): string[] {
  try {
    const { origin } = new URL(url);
    return [`${origin}/favicon.ico`, `${origin}/apple-touch-icon.png`, `${origin}/favicon.png`, `${origin}/icon.png`, `${origin}/favicon.svg`];
  } catch {
    return [];
  }
}
