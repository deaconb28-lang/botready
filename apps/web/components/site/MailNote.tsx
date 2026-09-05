import { CONTACT_EMAIL } from '@/lib/site';

/**
 * "We emailed a copy, and it may be in your spam."
 *
 * Two facts and no more. It was a paragraph and a half, which is a lot of
 * screen for a note about a thing the reader does not need — everything they
 * bought is on the page they are already looking at. What it must still say is
 * that the mail exists, who it is from, and where to look, because our domain
 * is weeks old and Gmail files us under spam more often than not.
 *
 * The subject line is gone with it. Sender plus inbox is enough to find one
 * message from today, and quoting it was the longest thing in here.
 */
export function MailNote({ to }: { to?: string | null }) {
  return (
    <aside className="edge flex items-start gap-3 rounded-[14px] bg-amber-tint p-[14px] shadow-hard-3">
      <span aria-hidden="true" className="mt-[2px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full border-2 border-ink bg-amber">
        <svg viewBox="0 0 18 18" className="h-[11px] w-[11px]">
          <path d="M2 4.5h14v9H2z" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M2.6 5.2L9 10l6.4-4.8" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-[1.55] text-ink">
        We emailed a copy{to ? <> to <span className="font-mono text-[12.5px]">{to}</span></> : null} from{' '}
        <span className="font-mono text-[12.5px]">{CONTACT_EMAIL}</span>. <strong className="font-semibold">Check your spam</strong>: we are a new
        domain. Anything missing, reply to it.
      </p>
    </aside>
  );
}
