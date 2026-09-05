import Link from 'next/link';

import { CONTACT_EMAIL, CREDIT, PUBLIC_INDEX_LISTED } from '@/lib/site';
import { ProductHuntBadge } from './ProductHuntBadge';

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline-4 bg-paper">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-[30px] px-6 py-9 sm:px-[26px]">
        <div>
          <div className="display text-[18px]">
            botready<span className="text-placeholder">.dev</span>
          </div>
          <p className="mt-2 max-w-[38ch] text-[14.5px] leading-[1.55] text-subtle-2">
            We ask your site the way an AI agent would, then hand you the files that fix what it found.
          </p>
          <ProductHuntBadge className="mt-[18px] inline-block" />
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
