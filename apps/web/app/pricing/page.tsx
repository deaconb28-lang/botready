import type { Metadata } from 'next';
import Link from 'next/link';

import { ButtonLink, Footer, Measure, Microcopy, Nav, SectionHeading, Shell, buttonClass } from '@/components/primitives';
import { LIMITS, PRICING } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'The diagnosis is free and fully visible. The paid artifact is the generated fix files, at $99 once, and monitoring at $29 a month.',
};

/**
 * Three tiers. The featured one — the fix pack — is set on the ink surface,
 * the same material as the grade band and the paywall, so "the thing you pay
 * for" looks like one thing across the product.
 */
export default function PricingPage() {
  return (
    <Shell>
      <Nav action={<ButtonLink href="/" size="sm">Check a site</ButtonLink>} />

      <Measure as="main" wide className="pb-14 pt-6">
        <p id="main" className="label text-ink-60">
          Pricing
        </p>
        <h1 className="display-hero mt-3 max-w-[16ch] text-[40px] sm:text-[60px]">
          The diagnosis is free. The files are not.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] text-ink-60">
          Everything the scan measures is on a page anyone can read, never blurred. What you pay for
          is the pack of files that fixes it, generated from your own scan.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-[6px] border border-ink bg-ink md:grid-cols-3">
          <Tier
            name="The check"
            price="Free"
            cadence="no account"
            summary="Everything the scan measures, on a page anyone can read and link to."
            includes={[
              'The grade, the score and six category subscores',
              'Every client’s status code for the same URL',
              'Every finding with the raw request and response',
              'A share card, and a result page that keeps working',
              `${LIMITS.anonymousScansPerHour} scans an hour, or ${LIMITS.signedInScansPerHour} signed in`,
            ]}
            cta={{ label: 'Run a check', href: '/' }}
          />
          <Tier
            featured
            name="The fix pack"
            price={PRICING.fixpack.label}
            cadence={PRICING.fixpack.cadence}
            summary="Four generated files and a punch list, built from your scan."
            includes={[
              'llms.txt, from the pages we confirmed returned 200',
              'The robots.txt block naming the agents you refuse',
              'Link tags, Link header and negotiation notes for your top 20 URLs',
              'A JSON-LD block filled in from your own pages',
              'A punch list ordered by effort, not by points',
            ]}
            cta={{ label: 'Run a check first', href: '/' }}
            note="Bought per scan, from the result page. There is nothing to buy before you know what it says."
          />
          <Tier
            name="Monitoring"
            price={PRICING.monitor.label}
            cadence={PRICING.monitor.cadence}
            summary="We re-check weekly and tell you the day a WAF rule changes under you."
            includes={[
              'Weekly re-scans of the domains you claim',
              'An alert on any category drop, or a new 403 to any client',
              'Score history, with the change annotated',
              'The fix pack included, regenerated on every scan',
            ]}
            cta={{ label: 'Claim a domain', href: '/index/saas' }}
          />
        </div>

        <section className="mt-14 max-w-[760px]">
          <SectionHeading kicker="The reason">Why the score is free</SectionHeading>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-60">
            Because a blurred number is a worse product and a worse argument. If we hid the grade, the
            honest version of this page would be &ldquo;pay us to tell you whether you have a
            problem&rdquo;, and most people do not. Showing the whole diagnosis means the paid thing has
            to be worth buying on its own, which is the right constraint for us to be under.
          </p>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-60">
            It also makes the{' '}
            <Link href="/index/saas" className="underline">
              public index
            </Link>{' '}
            possible, which is where most people find this.
          </p>
          <Microcopy className="mt-5 leading-[1.7]">
            The{' '}
            <Link href="/what-we-check" className="underline">
              weights are published
            </Link>
            . Changing them is a versioned event, and every stored score records the version that
            produced it, so a re-weighting re-scores history rather than quietly rewriting it.
          </Microcopy>
        </section>
      </Measure>

      <Footer />
    </Shell>
  );
}

function Tier({
  name,
  price,
  cadence,
  summary,
  includes,
  cta,
  note,
  featured = false,
}: {
  name: string;
  price: string;
  cadence: string;
  summary: string;
  includes: string[];
  cta: { label: string; href: string };
  note?: string;
  featured?: boolean;
}) {
  const muted = featured ? 'text-ink-key' : 'text-ink-60';
  return (
    <section className={`flex flex-col px-6 py-7 ${featured ? 'on-ink bg-ink text-paper' : 'bg-paper'}`}>
      <p className={`label ${muted}`}>{name}</p>
      <p className="display-hero mt-3 text-[44px]">{price}</p>
      <p className={`mono mt-1 text-[12px] tracking-[0.04em] ${muted}`}>{cadence}</p>
      <p className={`mt-4 text-[14.5px] leading-[1.5] ${muted}`}>{summary}</p>

      <ul className="wire-line mt-5 flex-1 list-none space-y-1.5 p-0">
        {includes.map((item) => (
          <li key={item} className="flex gap-3">
            <span className={featured ? 'text-paper' : 'text-pass'} aria-hidden="true">
              200
            </span>
            <span className={muted}>{item}</span>
          </li>
        ))}
      </ul>

      <Link href={cta.href} className={buttonClass(featured ? 'paper' : 'ghost', 'md', 'mt-6 text-center')}>
        {cta.label}
      </Link>
      {note ? <p className={`mono mt-3 text-[11.5px] leading-[1.6] ${muted}`}>{note}</p> : null}
    </section>
  );
}
