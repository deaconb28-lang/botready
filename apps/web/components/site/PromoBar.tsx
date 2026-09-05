import Link from 'next/link';

import { PROMO } from '@/lib/site';

/**
 * The launch-day strip, above the header on every public page.
 *
 * Lime on ink, which is the pair the contrast test already covers, and the
 * code is set in mono because it is a thing to be typed rather than read.
 *
 * It scrolls away rather than sticking. An offer is worth one look at the top
 * of a page; a bar that follows you down every screen of a result you are
 * trying to read is an advert, and this product's whole argument is that it
 * shows you your own site rather than selling at you.
 *
 * Returns null when the promo is off, so taking it down is one boolean in
 * lib/site.ts and not a hunt through JSX.
 */
export function PromoBar() {
  if (!PROMO.active) return null;

  return (
    <Link
      href="/pricing"
      className="block border-b-2 border-ink bg-lime px-4 py-[7px] text-center font-mono text-[12.5px] text-ink no-underline hover:bg-white"
    >
      {PROMO.lead} Use code{' '}
      <span className="mx-[2px] rounded-[6px] border-2 border-ink bg-ink px-[7px] py-[1px] font-bold text-lime">
        {PROMO.code}
      </span>{' '}
      for {PROMO.off}.
    </Link>
  );
}
