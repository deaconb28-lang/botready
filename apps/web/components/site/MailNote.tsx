import Link from 'next/link';

import { CONTACT_EMAIL } from '@/lib/site';

/**
 * "We emailed a copy too, and it may be in your spam."
 *
 * The order of the two sentences is the whole point. Our mail lands in Gmail's
 * spam folder often enough that somebody who believes the email is the delivery
 * will sit waiting for something already on their screen, so this says first
 * that the page they are looking at is the delivery, and only then where the
 * copy went.
 *
 * botready.dev has been sending mail for about a week. A domain with no history
 * gets filtered however correct its DKIM, SPF and DMARC records are, and all
 * three of ours resolve. That is our problem to fix with time, but the person
 * who just paid is the one who cannot find their files, so it is said on the
 * page rather than left for them to work out.
 *
 * It names the sender, the subject and the address Stripe has on file, because
 * "check your spam" without any of those is a search the reader has to invent.
 */
export function MailNote({ to, subject }: { to?: string | null; subject: string }) {
  return (
    <aside className="edge rounded-[16px] bg-amber-tint p-[18px] shadow-hard-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-[2px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-ink bg-amber">
          <svg viewBox="0 0 18 18" className="h-[12px] w-[12px]">
            <path d="M2 4.5h14v9H2z" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M2.6 5.2L9 10l6.4-4.8" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="display m-0 text-[15.5px] font-semibold text-ink">We emailed a copy, and it may be in your spam</p>
          <p className="m-0 mt-[6px] text-[14px] leading-[1.6] text-ink">
            You do not need it. Everything you bought is on this page, and it stays here. But if you want the email, we are a
            new domain and it often lands in spam on the first try: look for{' '}
            <span className="font-mono text-[13px]">{CONTACT_EMAIL}</span>, subject{' '}
            <span className="font-mono text-[13px]">&ldquo;{subject}&rdquo;</span>
            {to ? (
              <>
                , sent to <span className="font-mono text-[13px]">{to}</span>
              </>
            ) : null}
            . Marking it &ldquo;not spam&rdquo; is what stops the next one going the same way.
          </p>
          <p className="m-0 mt-[8px] text-[13.5px] leading-[1.6] text-ink">
            Something missing? Write to{' '}
            <Link href={`mailto:${CONTACT_EMAIL}`} className="font-mono text-[13px]">
              {CONTACT_EMAIL}
            </Link>{' '}
            and we will sort it out.
          </p>
        </div>
      </div>
    </aside>
  );
}
