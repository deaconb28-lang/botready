import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/app/AppShell';
import { NewScanForm } from '@/components/app/NewScanForm';
import { cx } from '@/components/ui';
import { ownsFixpack, propertiesFor, requireUser } from '@/lib/app-context';
import { PRICING } from '@/lib/site';

export const metadata: Metadata = { title: 'New scan', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Scan a domain that is not a property yet, then claim it.
 *
 * Two audiences on one route. Somebody who already has properties wants the
 * form and nothing else. Somebody who has just signed in and has none is
 * standing in an empty product, and the form alone does not tell them a scan is
 * only step one.
 *
 * So the first run is three steps and each is one line. It was four dense
 * paragraphs, which is the mistake an empty state invites: nothing is on the
 * screen, so the screen gets filled with explanation. But the reader has one
 * question here, "what do I do", and every sentence past the answer stands
 * between them and the box they are supposed to type in. What claiming
 * actually involves belongs on the claim page, where they will be standing
 * when they need it.
 *
 * Monitoring is the one thing on this route that costs money, so it is said
 * once, under the path rather than inside it. It is not a fourth step: nobody
 * has to do it to finish.
 */
export default async function NewPropertyPage() {
  const user = await requireUser('/app/new');
  const [properties, owned] = await Promise.all([propertiesFor(user.id), ownsFixpack(user.id)]);
  const first = properties.length === 0;

  return (
    <AppShell property={null} properties={properties} email={user.email} owned={owned}>
      <div className="max-w-[620px]">
        <h1 className="display-tight text-[36px]">{first ? "You're in. One domain to go." : 'New scan'}</h1>
        <p className="mb-[26px] mt-[10px] text-[16px] leading-[1.55] text-body">
          {first
            ? 'Three steps. The first is free and takes about thirty seconds.'
            : 'One visit, six pages at most, about thirty seconds. When it finishes you can claim the domain and it becomes a property here.'}
        </p>

        {first ? (
          <>
            <Step n={1} title="Check a site you control" active>
              <p className="mb-4">Any site. No account, no card.</p>
              <NewScanForm mode="claim" />
            </Step>

            <Step n={2} title="Claim it">
              <p>Publish one DNS record or one meta tag, so we know the domain is yours. Two minutes.</p>
            </Step>

            <Step n={3} title="Then this fills in" last>
              <p>
                Score history, the five clients on every run, competitors, and the fix pack regenerated from your own
                pages. <Link href="/what-we-check">Every check we make</Link>.
              </p>
            </Step>

            <p className="mt-6 border-t border-hairline-2 pt-5 text-[14px] leading-[1.6] text-muted">
              Monitoring is optional: {PRICING.monitor.label} {PRICING.monitor.cadence} to re-check weekly and write to
              you the day a client that could read your site stops being able to.
            </p>
          </>
        ) : (
          <NewScanForm mode="claim" />
        )}
      </div>
    </AppShell>
  );
}

function Step({
  n,
  title,
  children,
  active = false,
  last = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <section className={cx('grid grid-cols-[30px_minmax(0,1fr)] gap-x-[16px]', last ? '' : 'pb-7')}>
      <div className="flex flex-col items-center gap-[6px]">
        <span
          aria-hidden="true"
          className={cx(
            'edge grid h-[30px] w-[30px] place-items-center rounded-full font-mono text-[14px] font-bold',
            active ? 'bg-lime text-ink' : 'bg-white text-ink',
          )}
        >
          {n}
        </span>
        {/* The line between the markers, so three sections read as one path. */}
        {last ? null : <span aria-hidden="true" className="w-[2px] flex-1 rounded-full bg-divider" />}
      </div>
      <div className="pb-1">
        <h2 className="display mt-[3px] text-[19px] font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <div className="mt-2 text-[15px] leading-[1.6] text-muted [&_p]:m-0">{children}</div>
      </div>
    </section>
  );
}
