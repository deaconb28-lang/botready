import type { Metadata } from 'next';
import Link from 'next/link';

import { ENGINES, LIVE_ENGINES, monthlyAskCostUsd } from '@botready/core';

import { ScaleBot } from '@/components/site/ScaleBot';
import { PricingStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Card, Container, DashConnector, GradeTile, PillEyebrow, TerminalLine, cx } from '@/components/ui';
import { FIX_FILES } from '@/lib/copy';
import { pageMetadata } from '@/lib/metadata';
import {
  CONTACT_EMAIL,
  EARLY_ACCESS,
  ENTERPRISE,
  PLAN_LIMITS,
  PRICING,
  PUBLIC_INDEX_LISTED,
  WATCHED_PER_WEEK,
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

/**
 * The four planes and what is actually running today.
 *
 * `part` is doing real work here. The answer plane has share of voice and one
 * live engine, and the action plane generates fixes but proves nothing yet.
 * Rounding either up to "built" would be the same species of claim this
 * product exists to catch on other people's sites.
 *
 * The glosses are phrases rather than sentences, because these render as one
 * row beside their state chips. Each one only has to say which plane it is;
 * the section above has already said what the tier does.
 */
/** How a plane's state reads on its chip. Short enough not to wrap a column. */
const STATE_LABEL = { built: 'Built', part: 'Part', none: 'Not yet' } as const;

const PLANES: Array<{ name: string; body: string; state: 'built' | 'part' | 'none' }> = [
  { name: 'The site', body: 'what each client retrieved', state: 'built' },
  { name: 'The answers', body: `${LIVE_ENGINES.length} of ${ENGINES.length} engines live`, state: 'part' },
  { name: 'The crawlers', body: 'proved, not claimed', state: 'built' },
  { name: 'One timeline', body: 'cause and effect', state: 'none' },
];

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

        {/* The plane we are building, priced and explicitly not for sale.
            Its own band rather than a fifth card, because a card in the grid
            reads as something you can buy and this is a waiting list.

            Dense on purpose. The first version of this gave each of the four
            things a reader needs — what it does, what exists under it, what it
            costs, what it will never do — its own headed block, and the band
            came out taller than the three tiers above it put together. A
            waiting list that outweighs the products is the wrong shape
            whatever it says, so the same four answers are here at a quarter of
            the height: the planes are one row of glosses rather than four
            cards of prose, and the price justification and the two refusals
            are one line each. Nothing was dropped; it is all said shorter. */}
        <section className="edge mt-[18px] rounded-[20px] bg-white p-[26px] shadow-hard-4 sm:p-[32px]" aria-labelledby="whats-next">
          {/* Two columns from md rather than lg. Stacked, the illustration
              panel stretched to the full width of the band and became a
              near-square of empty tint with a small robot in the middle —
              which is where most of this section's height went at tablet
              widths. */}
          <div className="grid items-center gap-7 md:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="eyebrow text-placeholder">Not for sale yet</span>
              <h2 id="whats-next" className="display-tight mt-2 text-[clamp(25px,3vw,34px)]">
                The other half of the question
              </h2>
              <p className="mt-[10px] max-w-[50ch] text-[15px] leading-[1.55] text-muted">
                Everything above measures one site. This is the whole category at once, and we would rather build it with a
                few people than announce it.
              </p>

              <ul className="m-0 mt-4 grid list-none gap-x-6 gap-y-[8px] p-0 sm:grid-cols-2">
                {[
                  ['🗣️', 'Every engine, side by side'],
                  ['📊', 'Your category ranked, weekly'],
                  ['💸', 'What an assistant’s visits were worth'],
                  ['🧵', 'All three on one timeline'],
                ].map(([icon, line]) => (
                  <li key={line} className="grid grid-cols-[20px_1fr] gap-[8px] text-[14px] leading-[1.45] text-muted">
                    <span aria-hidden className="text-[14px] leading-[1.4]">
                      {icon}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Price and button on one line rather than stacked, which is
                  most of the height the old version spent here. */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="display-tight text-[32px]">{EARLY_ACCESS.scale.label}</span>
                <span className="font-mono text-[12px] text-quiet">{EARLY_ACCESS.scale.cadence}, when it opens</span>
                <a
                  href={contactHref('Early access')}
                  className="edge rounded-[12px] bg-lime px-[22px] py-[12px] font-body text-[14.5px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white"
                >
                  Ask for early access
                </a>
              </div>
            </div>

            {/* The claim as a shape: one question up, several engines back,
                ranked — the whole difference between this plane and the scan. */}
            {/* Capped on a phone too, where it does still stack. */}
            <div className="edge mx-auto w-full max-w-[330px] rounded-[16px] bg-surface-alt p-4 shadow-hard-3 md:max-w-none">
              <div className="mx-auto max-w-[300px]">
                <ScaleBot />
              </div>
              <p className="mt-3 border-t-2 border-hairline-4 pt-3 text-center font-mono text-[11px] text-subtle-2">
                {ENGINES.length} engines in the catalog, {LIVE_ENGINES.length} live today
              </p>
            </div>
          </div>

          {/* What already exists under it, as four glosses on one row. A
              waiting list is easier to join when most of the machinery is
              running, and saying which part is not is what makes the rest
              believable. */}
          <div className="mt-6 grid gap-x-7 gap-y-4 border-t border-hairline-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANES.map((plane) => (
              // Name over gloss rather than beside it. Inline, the four
              // columns wrapped at different words and left hanging second
              // lines that read as broken rather than as columns.
              <div key={plane.name} className="grid grid-cols-[auto_1fr] items-start gap-x-[9px]">
                <span
                  className={cx(
                    'edge mt-[2px] flex-none rounded-[99px] px-[7px] py-[2px] font-mono text-[9.5px] uppercase tracking-[0.08em]',
                    plane.state === 'built' ? 'bg-lime text-ink' : plane.state === 'part' ? 'bg-amber text-ink' : 'bg-white text-subtle-2',
                  )}
                >
                  {STATE_LABEL[plane.state]}
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[13.5px] font-semibold leading-[1.3] text-ink">{plane.name}</span>
                  <span className="mt-[1px] block text-[12.5px] leading-[1.4] text-muted">{plane.body}</span>
                </span>
              </div>
            ))}
          </div>

          {/* The price justification and the two refusals, one line each.
              Both were headed blocks and neither needed to be: the figure is
              derived from engines.json so it cannot go stale, and the refusals
              are constraints rather than features. */}
          <div className="mt-5 grid gap-x-8 gap-y-[10px] border-t border-hairline-4 pt-4 lg:grid-cols-2">
            <p className="text-[13px] leading-[1.55] text-quiet">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-placeholder">Why the price</span>{' '}
              — {WATCHED_PER_WEEK} questions a week across {ENGINES.length} engines is about{' '}
              <span className="font-mono text-[12px] text-ink">${monthlyAskCostUsd(WATCHED_PER_WEEK)}</span> a month of model
              calls. Which is why cadence is a plan and not a switch.
            </p>
            <p className="text-[13px] leading-[1.55] text-quiet">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-placeholder">Never</span> — no bought
              conversation logs, so no invented prompt volumes. And no generated content: the write side we want is a fix,
              applied, then proved by a re-scan.
            </p>
          </div>
        </section>

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
