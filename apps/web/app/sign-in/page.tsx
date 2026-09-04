import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Cursor, Mark, PillEyebrow } from '@/components/ui';
import { currentUser, safeNext } from '@/lib/auth';
import { PLAN_LIMITS } from '@/lib/site';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

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
 * The split screen. Left: Google, or a magic link. Right: what is waiting
 * inside. There is no password anywhere in this product. Someone who is
 * already signed in has no business here and goes straight to their account.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = rawNext ? safeNext(rawNext) : '/account';

  const user = await currentUser();
  if (user) redirect(next);

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

            <a
              href={`/api/auth/google?next=${encodeURIComponent(next)}`}
              className="edge flex w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] bg-white p-[15px] font-body text-[15.5px] font-bold text-ink no-underline shadow-hard-4 transition-colors duration-150 hover:bg-lime hover:text-ink"
            >
              <span
                aria-hidden="true"
                className="inline-block h-5 w-5 flex-none rounded-full"
                style={{ background: 'conic-gradient(#EA4335 0deg 90deg, #FBBC05 90deg 180deg, #34A853 180deg 270deg, #4285F4 270deg 360deg)' }}
              />
              Continue with Google
            </a>

            <div className="my-[22px] flex items-center gap-3" aria-hidden="true">
              <span className="h-[2px] flex-1 bg-divider" />
              <span className="font-mono text-[12px] text-subtle">or</span>
              <span className="h-[2px] flex-1 bg-divider" />
            </div>

            <SignInForm next={next} initialError={error ?? null} />
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
