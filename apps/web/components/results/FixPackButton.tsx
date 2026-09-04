'use client';

import { useState } from 'react';

import { cx } from '@/components/ui';
import { PRICING } from '@/lib/site';

/**
 * The one paid action on a page that is otherwise entirely free, and the only
 * button on the site that gets the violet-on-lime treatment. It was plain ink
 * before, which made it the third button on the screen wearing the same clothes
 * as "Run a check" in the header.
 *
 * Both destinations are server routes that redirect — checkout to Stripe, the
 * download to a generated zip — so the click is followed by a wait with nothing
 * on screen. That is what the pending state is for: it survives the wait
 * because the browser keeps the old document painted until the redirect
 * resolves, and without it people click twice.
 */
export function FixPackButton({
  scanId,
  owned,
  on = 'light',
}: {
  scanId: string;
  owned: boolean;
  /** `violet` is inside the fix pack panel, where a violet button vanishes. */
  on?: 'light' | 'violet';
}) {
  const [pending, setPending] = useState(false);

  const href = owned ? `/api/fixpack/${scanId}` : `/api/checkout/${scanId}`;
  const label = owned ? 'Download the fix pack' : 'Get the fix pack';
  const waiting = owned ? 'Generating the files' : 'Opening checkout';

  const tone = owned
    ? 'bg-lime text-ink shadow-hard-4 lift hover:bg-white'
    : on === 'violet'
      ? 'bg-lime text-ink shadow-hard-4 lift hover:bg-white'
      : 'bg-violet text-white shadow-lime-6 hover:bg-ink';

  return (
    <a
      href={href}
      onClick={() => setPending(true)}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={cx(
        'edge inline-flex items-center justify-center gap-[10px] rounded-[12px] px-[22px] py-[15px] font-body text-[15.5px] font-bold no-underline transition-all duration-150',
        tone,
        pending && 'pointer-events-none opacity-80',
      )}
    >
      {pending ? (
        <>
          <Spinner />
          {waiting}
        </>
      ) : (
        <>
          {label}
          {owned ? null : (
            <span
              className={cx(
                'rounded-[7px] px-[8px] py-[2px] font-mono text-[13.5px] font-bold',
                on === 'violet' ? 'bg-ink text-lime' : 'bg-lime text-ink',
              )}
            >
              {PRICING.fixpack.label}
            </span>
          )}
        </>
      )}
    </a>
  );
}

/** Sized to the cap height of the label beside it, so the row does not jump. */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cx('anim-spin h-[15px] w-[15px] flex-none', className)}
    >
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="2.4" opacity=".28" />
      <path d="M8 1.6a6.4 6.4 0 0 1 6.4 6.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
