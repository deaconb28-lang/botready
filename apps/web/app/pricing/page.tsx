import type { Metadata } from 'next';
import Link from 'next/link';

import { PricingStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Card, Container, DashConnector, GradeTile, PillEyebrow, TerminalLine, cx } from '@/components/ui';
import { FIX_FILES } from '@/lib/copy';
import { pageMetadata } from '@/lib/metadata';
import { CONTACT_EMAIL, EARLY_ACCESS, PLAN_LIMITS, PRICING, PUBLIC_INDEX_LISTED } from '@/lib/site';

export const metadata: Metadata = pageMetadata('/pricing');

interface Tier {
  eyebrow: string;
  price: string;
  unit: string;
  body: string;
  items: string[];
  cta: { label: string; href: string; /** Route handler or mailto: render an <a>, not a <Link>. */ external?: boolean };
  dark?: boolean;
  highlight?: string;
}

const TIERS: Tier[] = [
  {
    eyebrow: 'The check',
    price: 'Free',
    unit: 'no account',
    body: 'Everything the scan measures, on a page anyone can read and link to.',
    items: [
      'The grade, the score and six category scores',
      "Every client's status code for the same URL",
      'Every finding with the raw request and response',
      'A share card and a result page that keeps working',
    ],
    cta: { label: 'Run a check', href: '/#check' },
  },
  {
    eyebrow: 'The fix pack',
    price: PRICING.fixpack.label,
    unit: PRICING.fixpack.cadence,
    body: 'Eight generated files and a punch list, built from your scan. Covers one domain; another is $5.',
    highlight: 'A full prompt for your coding agent. Paste it into Claude Code or Cursor and your site fixes itself.',
    items: [
      'llms.txt, from the pages we confirmed returned 200',
      'The robots.txt block naming the agents you refuse',
      'Link tags and negotiation notes for your top 20 URLs',
      'A JSON-LD block filled in from your own pages',
      'The questions buyers ask, as a FAQ block ready for your answers',
      'Price, audience and limits, in the fields an assistant matches on',
      'A punch list ordered by effort, not by points',
      'One domain. Add another for $5, as many as you like',
    ],
    cta: { label: 'Run a check first', href: '/#check' },
    dark: true,
  },
  {
    eyebrow: 'Monitoring',
    price: PRICING.monitor.label,
    unit: PRICING.monitor.cadence,
    body: 'We re-check weekly and tell you the day a firewall rule changes under you.',
    items: [
      `Weekly re-scans of up to ${PLAN_LIMITS.monitor.domains} domains you claim`,
      'An alert on any category drop, or a new refusal',
      `${PLAN_LIMITS.monitor.prompts} questions asked of an assistant every week, and whether the answer named you`,
      'Score history, with the change annotated',
      'The fix pack included, regenerated on every scan',
    ],
    cta: { label: 'Claim a domain', href: '/account/domains/new' },
  },
  {
    eyebrow: 'Agency',
    price: PRICING.agency.label,
    unit: PRICING.agency.cadence,
    body: 'The same thing across a client list, with one bill and one login.',
    items: [
      `${PLAN_LIMITS.agency.domains} domains, re-scanned weekly, each with its own public result page`,
      `${PLAN_LIMITS.agency.prompts} watched questions pooled across all of them, so you spend them where the work is`,
      'Share of voice: how often an assistant cites your client versus the competitors they named',
      'A fix pack for every domain, regenerated on every scan, yours to hand over under your own name',
      'An alert the day any client stops being readable',
      `${PLAN_LIMITS.agency.scansPerMonth} checks a month, which is more than a monthly report needs`,
    ],
    cta: { label: 'Start on agency', href: '/api/checkout/agency', external: true },
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <PricingStructuredData />
      <SiteHeader />
      <Container as="main" id="main" width={1240} className="pb-24 pt-14">
        <div className="text-center">
          <span className="eyebrow text-subtle-2">Pricing</span>
          <h1 className="display-tight mx-auto mt-3 max-w-[26ch] text-[clamp(38px,5.2vw,64px)]">Simple, transparent pricing</h1>
        </div>

        <div className="mt-11 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.eyebrow}
              className={cx(
                'flex flex-col p-[30px]',
                t.dark ? 'on-dark rounded-[22px] bg-ink text-on-ink-light' : 'edge rounded-[18px] bg-white shadow-hard-4',
              )}
            >
              <span className={cx('eyebrow', t.dark ? 'text-subtle-2' : 'text-placeholder')}>{t.eyebrow}</span>
              <div className="mb-[2px] mt-[14px] flex items-baseline gap-2">
                <span className="display-tight text-[44px]">{t.price}</span>
                <span className="font-mono text-[12.5px] opacity-70">{t.unit}</span>
              </div>
              <p className={cx('mt-[10px] text-[15px] leading-[1.6]', t.dark ? 'text-on-ink-soft' : 'text-muted')}>{t.body}</p>
              {t.highlight ? (
                <div className="edge mb-[2px] mt-[22px] rounded-[14px] bg-lime p-[18px] font-body text-[16px] font-bold leading-[1.4] text-ink shadow-violet-5">
                  <span className="mb-[10px] inline-block rounded-[6px] bg-ink px-[9px] py-[3px] font-mono text-[10.5px] font-bold tracking-[0.12em] text-lime">
                    Get BotReady now!
                  </span>
                  <div>{t.highlight}</div>
                  <TerminalLine className="mt-3 rounded-[9px] border-0 px-3 py-[10px]">$ claude &quot;apply botready-fixes.md&quot;</TerminalLine>
                </div>
              ) : null}
              <ul className="m-0 mb-6 mt-5 grid list-none gap-[11px] p-0">
                {t.items.map((item) => (
                  <li
                    key={item}
                    className={cx('bullet text-[14.5px] leading-[1.5]', t.dark ? 'text-on-ink' : 'text-muted')}
                    style={{ ['--bullet-color' as string]: t.dark ? '#5A646F' : '#D3D3CB' }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
              {(() => {
                const className = cx(
                  'mt-auto block w-full rounded-[12px] py-[14px] text-center font-body text-[15px] font-semibold no-underline',
                  t.dark ? 'bg-white text-ink hover:bg-lime' : 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-white',
                );
                return t.cta.external ? (
                  <a href={t.cta.href} className={className}>
                    {t.cta.label}
                  </a>
                ) : (
                  <Link href={t.cta.href} className={className}>
                    {t.cta.label}
                  </Link>
                );
              })()}
            </div>
          ))}
        </div>

        {/* The plane we are building, priced and explicitly not for sale.
            Its own band rather than a fifth card, because a card in the grid
            reads as something you can buy and this is a waiting list. The
            price is the one from the cost model in
            docs/platform-architecture.md, printed here so that nobody has to
            find out what it costs by asking. */}
        <section className="edge mt-[18px] rounded-[20px] bg-white p-[30px] shadow-hard-4 sm:p-[38px]" aria-labelledby="whats-next">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
            <div>
              <span className="eyebrow text-placeholder">Not for sale yet</span>
              <h2 id="whats-next" className="display-tight mt-3 text-[clamp(28px,3.4vw,40px)]">
                The other half of the question
              </h2>
              <p className="mt-3 max-w-[46ch] text-[16px] leading-[1.6] text-muted">
                Everything above measures what an assistant can read on your site. It cannot tell you what the assistant then says
                about you, or which crawlers actually turned up. We are building both, and we would rather build them with a few
                people who care than announce them to everyone.
              </p>
              <div className="mt-5 flex items-baseline gap-[9px]">
                <span className="display-tight text-[38px]">{EARLY_ACCESS.scale.label}</span>
                <span className="font-mono text-[12.5px] text-quiet">{EARLY_ACCESS.scale.cadence}, when it opens</span>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Early%20access`}
                className="edge mt-5 inline-block rounded-[12px] bg-lime px-[26px] py-[14px] font-body text-[15px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white"
              >
                Ask for early access
              </a>
            </div>
            <ul className="m-0 grid list-none content-start gap-[13px] p-0">
              {[
                'Which questions in your category name you, and which name a competitor instead',
                'The same question asked of several assistants, not just one, and the answers put side by side',
                'Which crawlers really fetched your pages — verified, not taken from a user-agent string',
                'How many of the visits an assistant sent you actually turned into something',
                'One timeline: what you changed, what the crawlers did, what the answers said afterwards',
              ].map((line) => (
                <li key={line} className="bullet text-[15px] leading-[1.5] text-muted" style={{ ['--bullet-color' as string]: '#4B44F5' }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-7 border-t border-hairline-4 pt-5 text-[14px] leading-[1.6] text-quiet">
            None of that is built. We are telling you the price and the plan now because you will want to know both before you
            build a year around us, and because a roadmap you can read is worth more than a demo you cannot.
          </p>
        </section>

        {/* Both things you can buy here arrive by email, and our mail still
            lands in spam at Gmail more often than not: the domain is weeks old
            and reputation is the one thing correct DKIM cannot buy. Better said
            before the purchase than discovered after it. */}
        <p className="mt-5 text-center text-[14px] leading-[1.6] text-muted">
          The files open in your browser the second you pay, and stay there. We email a copy from{' '}
          <span className="font-mono text-[13px]">{CONTACT_EMAIL}</span> as well, so check your spam folder for it: we are a new
          domain and filters have not met us yet.
        </p>

        <Card surface="violet" radius="panel-lg" shadow={7} className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-8 p-6 sm:p-[34px]">
          <div>
            <PillEyebrow>30 seconds from now</PillEyebrow>
            <h2 className="display mt-[14px] text-[clamp(30px,3.6vw,44px)] leading-[1.04] tracking-[-0.03em] text-white">Get BotReady now</h2>
            <p className="mt-3 max-w-[40ch] text-[16px] leading-[1.55] text-on-violet">
              Run the free check, see exactly which agents your site turns away, and decide about the files afterwards.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button href="/#check" tone="lime" size="lg" shadow={4} weight={700} className="px-[26px] text-[15.5px]">
                Run the free check
              </Button>
              {PUBLIC_INDEX_LISTED ? (
                <Button href="/chart" tone="outline-white" size="lg" className="px-[22px]">
                  See the public index
                </Button>
              ) : (
                <Button href="/what-we-check" tone="outline-white" size="lg" className="px-[22px]">
                  See what we check
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-[14px]">
            <div className="flex items-center gap-[14px]">
              <GradeTile grade="C−" caption="today" healthy={false} />
              <DashConnector className="min-w-[40px] flex-1" />
              <GradeTile grade="A" caption="after" healthy />
            </div>
            <div className="flex flex-wrap gap-2">
              {FIX_FILES.map((name, i) => (
                <span key={name} className="anim-rise edge rounded-[9px] bg-white px-[11px] py-[6px] font-mono text-[12.5px] font-medium text-ink" style={{ ['--i' as string]: i }}>
                  {name}
                </span>
              ))}
            </div>
            <TerminalLine>$ claude &quot;apply botready-fixes.md&quot;</TerminalLine>
          </div>
        </Card>

        <div className="mt-[52px] max-w-[66ch] border-t border-hairline-4 pt-7">
          <h2 className="display mb-3 text-[28px] tracking-[-0.03em]">Why the score is free</h2>
          <p className="mb-3 text-[16.5px] leading-[1.65] text-muted">
            Charging to see your score means charging most people to find out they are fine. So the whole diagnosis is free, and the files
            earn their own money.
          </p>
          <p className="text-[16.5px] leading-[1.65] text-muted">
            {PUBLIC_INDEX_LISTED ? (
              <>
                It also means every result can be a page anyone can open, which is how the <Link href="/chart">chart</Link> works.
              </>
            ) : (
              'It also means every result is a page anyone can open and link to, for as long as the address exists.'
            )}
          </p>
        </div>
      </Container>
      <SiteFooter />
    </div>
  );
}
