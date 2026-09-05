import Link from 'next/link';

import { CONTACT_EMAIL } from '@/lib/site';

/**
 * "Check your spam folder."
 *
 * botready.dev has been sending mail for about a week, and a domain with no
 * sending history goes to spam at Gmail more often than not however correct its
 * DKIM, SPF and DMARC records are. That is our problem, but the person who just
 * paid is the one who cannot find their files, so the honest thing is to say so
 * on the page rather than let them decide the email never came.
 *
 * It names the sender and the subject line, because "check your spam" without
 * either is a search the reader has to invent. `subject` is a template the
 * caller fills in with the domain.
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
          <p className="display m-0 text-[15.5px] font-semibold text-ink">Check your spam folder</p>
          <p className="m-0 mt-[6px] text-[14px] leading-[1.6] text-ink">
            We are a new domain, so our mail often lands there on the first try. Look for{' '}
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
            Still nothing after a few minutes? Write to{' '}
            <Link href={`mailto:${CONTACT_EMAIL}`} className="font-mono text-[13px]">
              {CONTACT_EMAIL}
            </Link>{' '}
            and we will send it again.
          </p>
        </div>
      </div>
    </aside>
  );
}
