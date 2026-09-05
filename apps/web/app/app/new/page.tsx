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
 * standing in an empty product, and the form alone does not tell them that a
 * scan is only step one — that the app fills in when they claim the domain,
 * which is a thing they have to go and prove. So the first-run version is the
 * three steps, with the form as step one and the rest stated before they
 * arrive rather than after.
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
            ? 'Nothing is here yet because nothing is yours yet. Three steps, and the first one is free and takes about thirty seconds.'
            : 'One visit, six pages at most, about thirty seconds. When it finishes you can claim the domain and it becomes a property here.'}
        </p>

        {first ? (
          <>
            <Step n={1} title="Check a site you control" active>
              <p className="mb-4">
                Any site. We ask for it as five different clients and compare what each one gets back. No account needed
                for this part and no card — the diagnosis is free, always.
              </p>
              <NewScanForm mode="claim" />
            </Step>

            <Step n={2} title="Claim it">
              <p>
                A result page is public; a property is yours. Claiming means publishing a token we give you — one DNS
                record, or one meta tag on the homepage — so that we know the domain is actually yours before we start
                keeping history and sending you mail about it. The result page links straight to it, and the whole thing
                is two minutes.
              </p>
            </Step>

            <Step n={3} title="Then this fills in" last>
              <p>
                Score history with every change annotated, the five clients on every run,{' '}
                <Link href="/what-we-check">every check we make</Link>, competitors measured the same way, and the fix
                pack regenerated from your own pages. Monitoring adds the weekly re-check and tells you the day a
                firewall rule starts refusing an agent that used to get through — {PRICING.monitor.label}{' '}
                {PRICING.monitor.cadence}, and it is the only thing here you have to decide about.
              </p>
            </Step>
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
