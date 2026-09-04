import type { Metadata } from 'next';

import { pageMetadata } from '@/lib/metadata';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Cursor, Mark, PillEyebrow } from '@/components/ui';
import { currentUser, safeNext } from '@/lib/auth';
import { authProviders } from '@/lib/auth-providers';
import { CRAWLER_EMAIL, PLAN_LIMITS } from '@/lib/site';

export const metadata: Metadata = pageMetadata('/sign-in', { robots: { index: false, follow: false } });

export const dynamic = 'force-dynamic';

const PERKS: Array<{ title: string; chip: string; body: string }> = [
  {
    title: 'Score history',
    chip: `${PLAN_LIMITS.monitor.domains} domains`,
    body: 'Every run kept, with the change annotated so you can see what moved the number.',
  },
  {
    title: 'Alerts',
    chip: 'Weekly',
    body: 'We tell you the day a firewall rule starts refusing an agent that used to get through.',
  },
  {
    title: 'Fix pack',
    chip: 'Included',
    body: 'Regenerated from your own pages on every scan, with the coding-agent prompt.',
  },
];

/**
 * The split screen. Left: Google, which is the only way in. Right: what is waiting
 * inside. There is no password anywhere in this product. Someone who is
 * already signed in has no business here and goes straight to their account.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = rawNext ? safeNext(rawNext) : '/account';

  const user = await currentUser();
  if (user) redirect(next);

  // Asked rather than assumed: the provider is a Supabase dashboard setting and
  // a button that leads to its raw JSON 400 is worse than no button.
  const providers = await authProviders();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main id="main" className="grid flex-1 items-stretch grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
        <div className="flex items-center justify-center px-8 py-14">
          <div className="w-full max-w-[400px]">
            <Link href="/" className="flex w-fit items-center gap-[10px] font-display text-[21px] font-bold tracking-[-0.02em] text-ink no-underline hover:text-ink">
              <Mark size={30} />
              BotReady
            </Link>
            <h1 className="mt-7 font-display text-[40px] font-bold leading-[1.04] tracking-[-0.035em]">Welcome back</h1>
            <p className="mb-[26px] mt-[10px] text-[16px] leading-[1.55] text-muted">
              Sign in to see your domains, your score history and the alerts we have logged since your last visit.
            </p>

            {/* The button stays white on hover and lifts instead. The G is
                Google's mark, and it may not be recoloured or set on a colour
                of ours — the lime hover this used to have put it on lime. */}
            {providers.google ? (
              <a
                href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                className="edge lift flex w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] bg-white p-[15px] font-body text-[15.5px] font-bold text-ink no-underline shadow-hard-4 transition-all duration-150"
              >
                <GoogleMark />
                Continue with Google
              </a>
            ) : (
              // Google is the only way in now, so when the provider is off there
              // is no second option to fall back to. Say that, rather than
              // leaving a panel with a heading and nothing under it.
              <p role="status" className="edge rounded-[12px] bg-amber-tint px-[15px] py-[14px] text-[15px] leading-[1.5] text-ink">
                Sign-in is unavailable right now. Nothing is wrong with your account and nothing needs doing — try again
                shortly, or write to <a href={`mailto:${CRAWLER_EMAIL}`}>{CRAWLER_EMAIL}</a> if it persists.
              </p>
            )}

            {error ? (
              <p role="alert" className="mt-4 font-mono text-[12.5px] font-medium leading-[1.5] text-coral-text">
                {error === 'missing-code'
                  ? 'That sign-in link was missing its code. Start again above.'
                  : error}
              </p>
            ) : null}

            <p className="mt-[18px] text-[14px] leading-[1.55] text-subtle-2">
              We ask Google for your email address and nothing else. There is no password anywhere in this product, and
              running a scan needs no account at all.
            </p>
          </div>
        </div>

        <aside className="on-dark flex items-center justify-center border-l-2 border-ink bg-violet px-10 py-14" aria-label="What is waiting inside">
          <div className="w-full max-w-[420px] text-white">
            <PillEyebrow>What is waiting inside</PillEyebrow>
            <ul className="m-0 mt-[22px] grid list-none gap-[14px] p-0">
              {PERKS.map((perk) => (
                <li key={perk.title} className="edge rounded-[14px] bg-white p-[18px] text-ink shadow-hard-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 whitespace-nowrap font-body text-[15.5px] font-bold">{perk.title}</span>
                    <span className="edge inline-flex flex-none items-center whitespace-nowrap rounded-[7px] bg-lime px-[9px] py-[2px] font-mono text-[11.5px] font-bold uppercase text-ink">
                      {perk.chip}
                    </span>
                  </div>
                  <p className="mt-[7px] text-[14px] leading-[1.5] text-muted">{perk.body}</p>
                </li>
              ))}
            </ul>
            <div className="edge mt-5 overflow-hidden text-ellipsis whitespace-nowrap rounded-[12px] bg-ink px-[15px] py-[13px] font-mono text-[12.5px] text-lime">
              $ botready watch yoursite.com <Cursor />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

/** Google's G, unmodified. Four paths, their colours, no recolouring. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 flex-none" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
