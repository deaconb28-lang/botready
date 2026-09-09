import type { Metadata } from 'next';
import Link from 'next/link';

import { PricingStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Card, Container, DashConnector, GradeTile, PillEyebrow, TerminalLine, cx } from '@/components/ui';
import { FIX_FILES } from '@/lib/copy';
import { pageMetadata } from '@/lib/metadata';
import {
  CONTACT_EMAIL,
  ENTERPRISE,
  PLAN_LIMITS,
  PRICING,
  PUBLIC_INDEX_LISTED,
  contactHref,
} from '@/lib/site';

export const metadata: Metadata = pageMetadata('/pricing');

interface Tier {
  eyebrow: string;
  price: string;
  unit: string;
  body: string;
  /**
   * One line each, with its own marker. An emoji rather than a dot because the
   * four cards are read by scanning down a column, and a symbol that differs
   * per line is faster to scan than a symbol that does not.
   */
  items: Array<[icon: string, text: string]>;
  /**
   * The tier this one contains, named rather than restated.
   *
   * Agency repeated five of monitoring's six bullets, which made the card long
   * and the relationship between the two plans something the reader had to
   * work out by comparing lists. Saying it once is shorter and answers the
   * question the reader actually has, which is "do I lose anything by moving
   * up".
   */
  includes?: string;
  cta: { label: string; href: string; /** Route handler or mailto: render an <a>, not a <Link>. */ external?: boolean };
  dark?: boolean;
  highlight?: string;
}

const TIERS: Tier[] = [
  {
    eyebrow: 'The check',
    price: 'Free',
    unit: 'no account',
    body: 'The whole diagnosis, on a page anyone can read and link to.',
    items: [
      ['🎯', 'Your grade, your score, six categories'],
      ['🤖', 'What each AI client got from the same URL'],
      ['🔬', 'Every finding, with the raw response'],
      ['🔗', 'A public result page that keeps working'],
    ],
    cta: { label: 'Run a check', href: '/#check' },
  },
  {
    eyebrow: 'The fix pack',
    price: PRICING.fixpack.label,
    unit: PRICING.fixpack.cadence,
    body: 'Eight files built from your own scan. One domain; another is $5.',
    highlight: 'A full prompt for your coding agent. Paste it into Claude Code or Cursor and your site fixes itself.',
    items: [
      ['📄', 'llms.txt, from pages we confirmed return 200'],
      ['🛡️', 'A robots.txt block and a WAF rule'],
      ['🏷️', 'JSON-LD filled in from your own pages'],
      ['❓', 'The questions buyers ask, ready for your answers'],
      ['💵', 'Price and audience, in fields an assistant matches on'],
      ['✅', 'A punch list ordered by effort, not by points'],
    ],
    cta: { label: 'Run a check first', href: '/#check' },
    dark: true,
  },
  {
    eyebrow: 'Agency',
    price: PRICING.agency.label,
    unit: PRICING.agency.cadence,
    body: 'Everything above, watched every week, across a client list.',
    items: [
      ['🔁', `Weekly re-scans of ${PLAN_LIMITS.agency.domains} domains, on one bill`],
      ['🚨', 'An alert the day any client stops being readable'],
      ['💬', `${PLAN_LIMITS.agency.prompts} questions asked of an assistant each week, pooled`],
      ['📣', 'Share of voice against the competitors you name'],
      ['🕵️', 'Which AI crawlers really fetched your pages, from your logs'],
      ['🪪', 'Each one checked against the vendor’s own addresses'],
      ['🏷️', 'A fix pack per domain, to hand over under your name'],
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

        <div className="mt-11 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
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
              {t.includes ? (
                <p
                  className={cx(
                    'mb-1 mt-5 font-mono text-[11.5px] font-medium uppercase tracking-[0.1em]',
                    t.dark ? 'text-subtle-2' : 'text-placeholder',
                  )}
                >
                  {t.includes}
                </p>
              ) : null}
              <ul className={cx('m-0 mb-6 grid list-none gap-[10px] p-0', t.includes ? 'mt-3' : 'mt-5')}>
                {t.items.map(([icon, text]) => (
                  <li
                    key={text}
                    className={cx(
                      'grid grid-cols-[20px_1fr] gap-[9px] text-[14px] leading-[1.45]',
                      t.dark ? 'text-on-ink' : 'text-muted',
                    )}
                  >
                    {/* aria-hidden: the emoji is a bullet, and a screen reader
                        announcing "office building" before every line is worse
                        than announcing nothing. */}
                    <span aria-hidden className="text-[15px] leading-[1.35]">
                      {icon}
                    </span>
                    <span>{text}</span>
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

        {/* Enterprise, which is a conversation rather than a tier.
            A band and not a card for the same reason as the section above it:
            there is no checkout behind this and a card in a price grid implies
            one. The only figure is the floor, and it is the floor of the tier
            above so the two cannot disagree. */}
        <section
          className="edge mt-[18px] rounded-[20px] bg-ink p-[30px] shadow-hard-5 sm:p-[38px]"
          aria-labelledby="enterprise"
        >
          <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="eyebrow text-on-ink-soft">Bigger than the plans above</span>
              <h2 id="enterprise" className="display-tight mt-3 text-[clamp(26px,3vw,36px)] text-white">
                Talk to us
              </h2>
              <p className="mt-3 max-w-[50ch] text-[15.5px] leading-[1.6] text-on-ink">
                Every one of these is a number in our cost model rather than a switch, so the answer comes from a person who
                can tell you what exists today and what does not.
              </p>
              <ul className="m-0 mt-5 grid list-none gap-x-8 gap-y-[9px] p-0 sm:grid-cols-2">
                {[
                  ['🏢', 'Hundreds of domains'],
                  ['⏱️', 'Daily, or on demand'],
                  ['🔌', 'Your own log pipeline'],
                  ['📝', 'A contract and an invoice'],
                ].map(([icon, line]) => (
                  <li key={line} className="grid grid-cols-[20px_1fr] gap-[9px] font-mono text-[12.5px] text-on-ink-soft">
                    <span aria-hidden>{icon}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:justify-self-end">
              <div className="flex items-baseline gap-[9px]">
                <span className="display-tight text-[40px] text-white">{ENTERPRISE.from.label}</span>
                <span className="font-mono text-[12.5px] text-on-ink-soft">{ENTERPRISE.from.cadence}</span>
              </div>
              <p className="mt-2 max-w-[30ch] text-[13.5px] leading-[1.55] text-on-ink-soft">
                Where it starts. What it costs depends on how often you want us to ask, which is the only honest way to price
                it.
              </p>
              <a
                href={contactHref(ENTERPRISE.subject)}
                className="edge mt-5 inline-block rounded-[12px] bg-lime px-[26px] py-[14px] font-body text-[15px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white"
              >
                Talk to us
              </a>
              <p className="mt-3 font-mono text-[12px] text-on-ink-soft">
                {CONTACT_EMAIL} · a person replies, not a form
              </p>
            </div>
          </div>
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
