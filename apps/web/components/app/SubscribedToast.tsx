'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * The one moment after paying for monitoring.
 *
 * Somebody who has just subscribed used to be dropped back on the claim page,
 * which is where they were before they paid and says nothing about what they
 * bought. They land in the app now, and this says the thing a receipt cannot:
 * that it worked, and what happens next.
 *
 * It takes itself down after eight seconds and strips `?subscribed=1` from the
 * URL as soon as it is shown, so a refresh or a shared link does not
 * congratulate anyone twice.
 */
export function SubscribedToast({ domain }: { domain: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // The message has been delivered; the URL should not keep claiming it.
    // `replace` rather than `push` so Back does not return to the banner.
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      // Polite, not assertive: this is good news, not something that should
      // interrupt whatever a screen reader is in the middle of.
      role="status"
      aria-live="polite"
      className="anim-pop edge fixed bottom-5 left-1/2 z-[80] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-[16px] bg-lime p-[18px] shadow-hard-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-ink bg-white"
        >
          <svg viewBox="0 0 18 18" className="h-[14px] w-[14px]">
            <path d="M4.5 9.2l3 2.9 6-6.4" fill="none" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="display m-0 text-[16px] font-semibold text-ink">Thank you for subscribing!</p>
          <p className="m-0 mt-1 text-[13.5px] leading-[1.5] text-ink">
            We re-check {domain} every week and email you the day something changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-[8px] border-0 bg-transparent px-2 py-1 font-mono text-[15px] leading-none text-ink hover:bg-ink hover:text-lime"
        >
          ×
        </button>
      </div>
    </div>
  );
}
