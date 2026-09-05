'use client';

import { useEffect, useRef, useState } from 'react';

import { cx } from '@/components/ui';

/**
 * The scanned site's own icon, with its initial underneath.
 *
 * One request, made by the reader's browser, to the scanned site's own origin.
 * No favicon service: those work by being told every domain anyone looks up,
 * and a tool that measures who a site lets read it should not hand a third
 * party the list of sites its users are curious about.
 *
 * The letter is not a spinner. It is what is shown when the icon fails, which
 * it does for every site serving no /favicon.ico, so the tile is never empty
 * and never shifts size.
 */
export function SiteFavicon({
  src,
  domain,
  size = 22,
  className = '',
}: {
  src: string;
  domain: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const monogram = (domain.replace(/^www\./, '')[0] ?? '?').toUpperCase();

  // The <img> is server-rendered, so a fast 404 can fire its error event before
  // React has hydrated and attached the handler below — and then the tile keeps
  // the browser's broken-image glyph forever. Asking the element directly on
  // mount catches the failure that already happened.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (!src || failed) {
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
      ref={img}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx('shrink-0 rounded-[5px] object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** /favicon.ico on the scanned site's own origin, or empty for an unusable URL. */
export function fallbackIcon(url: string): string {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return '';
  }
}
