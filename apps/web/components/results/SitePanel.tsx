'use client';

import { useEffect, useRef, useState } from 'react';

import type { SiteIdentity } from '@/lib/site-identity';
import { SiteFavicon } from './SiteFavicon';
import { cx } from '@/components/ui';

/**
 * The scanned site, as itself.
 *
 * Under the client panel, because the two answer each other: that panel says
 * what five clients received for this URL, and this shows the thing they were
 * asking for. Seeing the actual site next to "claudebot got 403" is what makes
 * the comparison land as a fact about somewhere real rather than a table.
 *
 * The frame is the site's own document, loaded by the reader's browser from
 * the site's own origin. We put nothing into it and read nothing out of it: it
 * is sandboxed without `allow-same-origin` to us, it cannot navigate this page,
 * and it is inert to the pointer so that the only thing a click can do is open
 * the real site in a new tab.
 */
export function SitePanel({
  identity,
  fixture = false,
  className = '',
}: {
  identity: SiteIdentity;
  /** The fixture preview names a domain that does not exist. Do not fetch it. */
  fixture?: boolean;
  className?: string;
}) {
  // Only frame a site we have established will allow it.
  //
  // This used to try whenever we were unsure, on the reasoning that most sites
  // allow framing and a preview is worth a gamble. It is not: a browser that
  // refuses a frame paints its own opaque error page inside it, so a lost
  // gamble is a white rectangle and nothing drawn behind it can show through.
  // There is no way to ask a cross-origin frame whether it painted, so the
  // question has to be settled before the element exists — see lib/site-probe.
  const embeddable = !fixture && identity.framing === 'allowed';

  return (
    <section
      className={cx('edge overflow-hidden rounded-[16px] bg-white shadow-hard-4', className)}
      aria-label={`${identity.domain}, as it looks in a browser`}
    >
      {/* The header is a link in every state, so the sentence the panel falls
          back to always has something to point at. */}
      <a
        href={identity.url}
        target="_blank"
        // nofollow ugc: the destination is whatever domain someone typed into
        // the scan box, not a site we are vouching for.
        rel="noopener noreferrer nofollow ugc"
        className="flex items-center gap-[10px] border-b-2 border-ink bg-surface-alt px-4 py-[11px] no-underline"
      >
        <SiteFavicon candidates={identity.iconCandidates} domain={identity.domain} size={22} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] font-medium text-ink">{identity.domain}</span>
          {identity.title ? <span className="block truncate text-[12.5px] leading-[1.3] text-subtle-2">{identity.title}</span> : null}
        </span>
        <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-subtle-2">↗</span>
      </a>

      {embeddable ? (
        <Preview identity={identity} />
      ) : (
        <p className="border-b border-hairline px-4 py-[18px] text-[13.5px] leading-[1.5] text-subtle-2">{unavailable(fixture, identity.framing)}</p>
      )}

      {identity.description ? (
        <p className="border-t border-hairline px-4 py-[14px] text-[13.5px] leading-[1.5] text-muted">{identity.description}</p>
      ) : (
        <p className="border-t border-hairline px-4 py-[14px] text-[13.5px] leading-[1.5] text-subtle-2">
          This page has no meta description, so there is no sentence of its own to show here.
        </p>
      )}
    </section>
  );
}

/**
 * Why there is no frame. Three different reasons and three different
 * sentences: saying a site forbids framing when we simply could not reach it
 * would be stating a fact about someone's headers that we never read.
 */
function unavailable(fixture: boolean, framing: SiteIdentity['framing']): string {
  if (fixture) return 'This is a fixture, so there is no site to show here. A real result frames the page that was scanned.';
  if (framing === 'refused') {
    return 'This site sends a header that forbids putting it in a frame, so we are not showing one. That is a deliberate setting and a reasonable one; the name above opens it.';
  }
  return 'We could not reach this site just now to find out whether it allows being framed, so we are not guessing. The name above still opens it.';
}

/** The width the frame is laid out at before it is scaled down to fit. */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 800;

/**
 * The frame, drawn at desktop size and scaled to whatever width the column
 * happens to be. Rendering it small instead would give a phone layout, which
 * is not what the scan measured.
 */
function Preview({ identity }: { identity: SiteIdentity }) {
  const box = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width > 0) setScale(width / DESIGN_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={identity.url}
      target="_blank"
      // `nofollow ugc` because the destination is whatever domain someone
      // typed into the scan box, not a site we are vouching for.
      rel="noopener noreferrer nofollow ugc"
      className="group relative block overflow-hidden border-b border-hairline bg-surface-alt"
      ref={box}
      style={{ height: scale > 0 ? DESIGN_HEIGHT * scale : undefined, aspectRatio: scale > 0 ? undefined : `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}` }}
    >
      {/* Behind the frame, not over it.
          A page that loads paints its own background across this and it is
          never seen. A page that does not — still loading, or refusing to be
          framed with a header this scan is too old to have recorded — leaves
          this showing, and it has to be a card rather than a white hole. We
          cannot ask a cross-origin frame whether it painted, so the answer is
          to make both outcomes look deliberate. */}
      <span aria-hidden="true" className="absolute inset-0 grid content-center justify-items-center gap-[6px] px-5 text-center">
        <SiteFavicon candidates={identity.iconCandidates} domain={identity.domain} size={30} />
        <span className="display line-clamp-2 text-[15px] font-semibold text-ink">{identity.title || identity.domain}</span>
        <span className="font-mono text-[11.5px] text-subtle-2">open {identity.domain} ↗</span>
      </span>
      {scale > 0 ? (
        <iframe
          src={identity.url}
          title={`${identity.domain} in a frame`}
          // `allow-same-origin` restores the framed document's OWN origin — not
          // ours. Without it the page loads into an opaque origin where
          // localStorage throws and its web fonts fail CORS, so a modern site
          // renders in fallback type or white-screens on boot. It is still
          // cross-origin to us and can read nothing of this page; what is
          // withheld is what matters: no top-level navigation, no popups, no
          // modals, no forms.
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
          style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
        />
      ) : null}
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-ink/85 px-3 py-[7px] font-mono text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="truncate">{identity.url}</span>
        <span className="shrink-0">open ↗</span>
      </span>
    </a>
  );
}
