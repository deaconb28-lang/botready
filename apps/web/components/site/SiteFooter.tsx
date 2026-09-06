import Link from 'next/link';

import { CONTACT_EMAIL, CREDIT, PUBLIC_INDEX_LISTED, SITE } from '@/lib/site';
import { LaunchBuffBadge } from './LaunchBuffBadge';
import { ProductHuntBadge } from './ProductHuntBadge';

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline-4 bg-paper">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-[30px] px-6 py-9 sm:px-[26px]">
        <div>
          <div className="flex items-baseline gap-[9px]">
            <span className="display text-[18px]">
              botready<span className="text-placeholder">.dev</span>
            </span>
            <span className="font-mono text-[11.5px] text-placeholder">v{SITE.version}</span>
          </div>
          <p className="mt-2 max-w-[38ch] text-[14.5px] leading-[1.55] text-subtle-2">
            We ask your site the way an AI agent would, then hand you the files that fix what it found.
          </p>
          {/* A row, wrapping on narrow screens. Both are shown at 54 high so
              they sit level: two badges at two heights read as two accidents
              rather than as a set. */}
          <div className="mt-[18px] flex flex-wrap items-center gap-[14px]">
            <ProductHuntBadge />
            <LaunchBuffBadge />
          </div>
          <p className="mt-[14px] font-mono text-[12.5px] text-subtle-2">
            <a href={CREDIT.href} className="text-subtle-2 no-underline hover:text-ink">
              {CREDIT.text}
            </a>
          </p>
        </div>
        <div className="flex gap-10 text-[14px]">
          <div className="grid content-start gap-[9px]">
            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-placeholder">PRODUCT</span>
            <Link href="/what-we-check">What we check</Link>
            <Link href="/pricing">Pricing</Link>
            {PUBLIC_INDEX_LISTED ? <Link href="/chart">The chart</Link> : null}
          </div>
          <div className="grid content-start gap-[9px]">
            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-placeholder">FOR DEVELOPERS</span>
            <Link href="/docs">API and docs</Link>
            <Link href="/bot">Our crawler</Link>
            <Link href="/what-we-check#weights">Published weights</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
