import type { Metadata } from 'next';
import Link from 'next/link';

import { ButtonLink, Footer, Microcopy, Nav } from '@/components/primitives';
import { LIMITS, PRICING } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'The diagnosis is free and fully visible. The paid artifact is the generated fix files, at $99 once, and monitoring at $29 a month.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav
        action={
          <ButtonLink href="/" size="sm">
            Check a site
          </ButtonLink>
        }
      />

      <main id="main" className="max-w-[900px] px-5 pb-14 pt-10 sm:px-7">
        <h1
          className="font-display text-[30px] font-extrabold tracking-[-0.02em] sm:text-[38px]"
          style={{ fontVariationSettings: "'wdth' 112" }}
        >
          Pricing
        </h1>
        <p className="mt-3 max-w-[64ch] text-[16px] text-ink-60">
          The diagnosis is free, fully visible, and never blurred. What you pay for is the pack of
          files that fixes it, generated from your own scan.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Tier
            name="The check"
            price="Free"
            cadence="no account"
            summary="Everything the scan measures, on a page anyone can read and link to."
            includes={[
              'The full grade, score and six category subscores',
              'Every client’s status code for the same URL',
              'Every finding with the raw request and response',
              'A share card, and a public result page that keeps working',
              `${LIMITS.anonymousScansPerHour} scans an hour, or ${LIMITS.signedInScansPerHour} signed in`,
            ]}
            cta={{ label: 'Run a check', href: '/' }}
          />

          <Tier
            name="The fix pack"
            price={PRICING.fixpack.label}
            cadence={PRICING.fixpack.cadence}
            summary="Four generated files and a prioritised punch list, built from your scan."
            emphasis
            includes={[
              'llms.txt, built from the pages we confirmed returned 200',
              'The robots.txt block naming the agents you are refusing',
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

        <section className="mt-12 border-t border-ink pt-7">
          <h2 className="text-[20px] font-bold">Why the score is free</h2>
          <p className="mt-2 max-w-[70ch] text-[14px] text-ink-60">
            Because a blurred number is a worse product and a worse argument. If we hid the grade,
            the honest version of this page would be &ldquo;pay us to tell you whether you have a
            problem&rdquo;, and most people do not. Showing the whole diagnosis means the paid
            thing has to be worth buying on its own, which is the right constraint for us to be
            under.
          </p>
          <p className="mt-3 max-w-[70ch] text-[14px] text-ink-60">
            It also makes the{' '}
            <Link href="/index/saas" className="underline">
              public index
            </Link>{' '}
            possible, which is where most people find this.
          </p>
          <Microcopy className="mt-5">
            The{' '}
            <Link href="/what-we-check" className="underline">
              weights are published
            </Link>
            . Changing them is a versioned event, and every stored score records the version that
            produced it, so a re-weighting re-scores history rather than quietly rewriting it.
          </Microcopy>
        </section>
      </main>

      <Footer />
    </div>
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
  emphasis = false,
}: {
  name: string;
  price: string;
  cadence: string;
  summary: string;
  includes: string[];
  cta: { label: string; href: string };
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <section
      className={`flex flex-col rounded-[6px] bg-card px-[22px] py-5 ${
        emphasis ? 'border-[1.5px] border-ink' : 'border border-rule'
      }`}
    >
      <h2 className="text-[16px] font-semibold">{name}</h2>
      <p
        className="mt-2 font-display text-[34px] font-extrabold leading-none"
        style={{ fontVariationSettings: "'wdth' 116" }}
      >
        {price}
      </p>
      <p className="mt-1 font-data text-[12px] tracking-[0.04em] text-ink-60">{cadence}</p>
      <p className="mt-3 text-[14px] text-ink-60">{summary}</p>

      <ul className="mt-4 flex-1 list-none space-y-2 p-0 text-[13.5px]">
        {includes.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="text-pass" aria-hidden="true">
              ✓
            </span>
            <span className="text-ink-60">{item}</span>
          </li>
        ))}
      </ul>

      <ButtonLink
        href={cta.href}
        tone={emphasis ? 'solid' : 'ghost'}
        className="mt-5 text-center"
      >
        {cta.label}
      </ButtonLink>

      {note ? <p className="mt-2.5 font-data text-micro text-ink-60">{note}</p> : null}
    </section>
  );
}
