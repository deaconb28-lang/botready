import type { Metadata } from 'next';

import { HomeStructuredData } from '@/components/site/StructuredData';
import { pageMetadata } from '@/lib/metadata';

import { AgentRace } from '@/components/home/AgentRace';
import { BotScene } from '@/components/bot/BotScene';
import { ChatProof } from '@/components/home/ChatProof';
import { HeroScanCard } from '@/components/home/HeroScanCard';
import { Copy, CopyItem } from '@/components/ModeText';
import { SiteFooter } from '@/components/site/SiteFooter';
import { TwelveToolsBadge } from '@/components/site/TwelveToolsBadge';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Card, Container, Eyebrow, PillEyebrow, TerminalCard, cx } from '@/components/ui';
import { FIX_FILES } from '@/lib/copy';

export const metadata: Metadata = pageMetadata('/');

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-canvas">
      <HomeStructuredData />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Problem />
        <Container className="pt-[76px]">
          <AgentRace />
        </Container>
        <BrowserVsAgent />
        <WhyAeo />
        <TheCheck />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <Container as="section" width={1120} className="pt-[72px]">
      {/* Hoisted out of the grid on purpose: inside a 1fr track the badge wraps
          within its own pill shape. */}
      <div className="edge inline-flex max-w-full items-center gap-[10px] whitespace-nowrap rounded-full bg-white py-[5px] pl-[5px] pr-[14px] text-[13.5px] text-muted">
        <span className="rounded-full bg-ink px-[9px] py-[3px] font-mono text-[11px] font-medium tracking-[0.06em] text-white">NEW</span>
        <span className="overflow-hidden text-ellipsis">
          <Copy k="badge" />
        </span>
      </div>

      <div className="mt-7 grid grid-cols-1 items-center gap-[30px] lg:grid-cols-[minmax(0,1fr)_384px]">
        {/* min-w-0: a grid item defaults to min-width:auto, and the scan card's
            input-plus-nowrap-button row has a min-content wider than a phone,
            which pushes the whole track past the viewport. */}
        <div className="min-w-0">
          <h1 className="display-tight text-[clamp(42px,6vw,72px)]">Are you BotReady?</h1>
          <p className="mt-5 max-w-[50ch] text-[18.5px] leading-[1.55] text-muted">
            <Copy k="heroSub" />
          </p>
          <div className="mt-8">
            <HeroScanCard className="ml-0" />
          </div>

          {/* Under the box, never above it. Social proof belongs at the moment
              somebody is deciding whether to type their URL in, and the one
              thing the home page is for is the thing nothing gets to push
              down. */}
          <TwelveToolsBadge className="mt-6 inline-block" />
        </div>

        {/* Decorative, and the first thing to go: below the two-column
            breakpoint the input matters more than the mascot, and the graphic
            carries no information to lose. */}
        <BotScene variant="surfing" className="hidden lg:block" />
      </div>
    </Container>
  );
}

function Problem() {
  return (
    <Container as="section" width={1000} className="pt-14">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-6">
        <ChatProof />
        <div className="pt-2">
          <Eyebrow>The problem [01]</Eyebrow>
          <h2 className="display mt-3 text-[clamp(28px,3.4vw,40px)] leading-[1.08] tracking-[-0.03em]">
            <Copy k="whyTitle" />
          </h2>
          <p className="mt-[14px] text-[16.5px] leading-[1.6] text-muted">
            <Copy k="whyBody" />
          </p>
          <ul className="m-0 mt-5 grid list-none gap-[10px] p-0">
            {([0, 1, 2] as const).map((i) => (
              <li key={i} className="flex items-start gap-[11px] text-[15.5px] leading-[1.5] text-ink">
                <span aria-hidden="true" className="mt-2 h-[6px] w-[6px] flex-none rounded-full bg-violet" />
                <span>
                  <CopyItem k="whyPoints" i={i} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}

function BrowserVsAgent() {
  return (
    <Container as="section" className="pt-[76px]">
      <div className="mx-auto max-w-[620px] text-center">
        <Eyebrow>The problem [02]</Eyebrow>
        <h2 className="display mt-3 text-[clamp(30px,4vw,46px)] leading-[1.06] tracking-[-0.03em]">Same URL, same second, two different answers</h2>
      </div>

      <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-[22px]">
        {/* A browser-chrome card rendering a plausible product page. An example. */}
        <Card radius="card-lg" shadow={4} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b-2 border-ink bg-chip-bg px-[14px] py-[11px]">
            <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full bg-[#E0655A]" />
            <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full bg-[#E6B84F]" />
            <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full bg-[#69B98A]" />
            <span className="edge ml-2 flex-1 rounded-[7px] bg-white px-[10px] py-1 font-mono text-[11.5px] text-subtle-2">yoursite.com</span>
          </div>
          <div className="px-5 pb-6 pt-[22px]">
            <div className="mb-[18px] flex items-center justify-between">
              <span className="display text-[15px]">Yoursite</span>
              <span className="flex gap-3 text-[11.5px] text-subtle-2">
                <span>Product</span>
                <span>Pricing</span>
                <span>Docs</span>
              </span>
            </div>
            <div className="display text-[22px] leading-[1.15]">Weekly planning for small teams</div>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-muted">
              Issues, roadmap and a weekly plan in one place. Free for your first five people.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['Free', '5 people'],
                ['$8', 'per seat'],
                ['$14', 'business'],
              ].map(([price, unit]) => (
                <div key={price} className="rounded-[10px] border border-hairline-3 p-[10px]">
                  <div className="font-body text-[13px] font-semibold">{price}</div>
                  <div className="mt-[2px] text-[10.5px] text-subtle-2">{unit}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-[10px] border-t border-hairline bg-paper px-[18px] py-3">
            <span className="font-mono text-[11.5px] font-medium tracking-[0.06em] text-green-text">200 OK · 9,240 readable characters</span>
            <span className="font-mono text-[11.5px] text-subtle-2">chrome</span>
          </div>
        </Card>

        <TerminalCard
          title="ClaudeBot/1.0 — response"
          footer={
            <>
              <span className="font-mono text-[11.5px] font-medium tracking-[0.06em] text-coral-dark">403 · 312 readable characters</span>
              <span className="font-mono text-[11.5px] text-on-ink-muted">claudebot</span>
            </>
          }
        >
          {/* The blank line before "(nothing readable)" lives inside a text node
              that also carries visible text, so it is not collapsed. */}
          <pre className="overflow-auto px-5 py-[22px] font-mono text-[12.5px] leading-[1.85]">
            <span>{'GET / HTTP/1.1\nHost: yoursite.com\nUser-Agent: ClaudeBot/1.0\n'}</span>
            <span>{'\nHTTP/1.1 '}</span>
            <span className="text-coral-dark">403 Forbidden</span>
            <span>{'\nserver: cloudflare\n'}</span>
            <span className="text-coral-dark">cf-mitigated: challenge</span>
            <span className="text-on-ink-muted">{'\n\n(nothing readable)'}</span>
          </pre>
        </TerminalCard>
      </div>
      <p className="mx-auto mt-[22px] max-w-[60ch] text-center text-[15.5px] text-muted">
        <Copy k="agentNote" />
      </p>
    </Container>
  );
}

function WhyAeo() {
  return (
    <Container as="section" id="aeo" className="pt-20">
      <div className="mx-auto max-w-[640px] text-center">
        <Eyebrow>Why AEO matters [03]</Eyebrow>
        <h2 className="display mt-3 text-[clamp(30px,4vw,46px)] leading-[1.06] tracking-[-0.03em]">Three ways this quietly costs you customers</h2>
        <p className="mt-3 text-[16.5px] leading-[1.6] text-muted">None of them show up in a dashboard, which is why they run for months.</p>
      </div>
      <div className="mt-[34px] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px]">
        <Card radius="panel" shadow={5} lift className="p-6">
          <div className="edge grid gap-[9px] rounded-[14px] bg-canvas p-4">
            <div className="flex flex-wrap gap-2">
              {['Linear', 'Height', 'Shortcut'].map((name) => (
                <span key={name} className="edge rounded-full bg-lime px-[11px] py-[3px] font-mono text-[12px] font-bold">
                  {name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-[9px]">
              <span className="rounded-full border-2 border-dashed border-coral bg-white px-[11px] py-[3px] font-mono text-[12px] font-bold text-coral-text line-through">
                yoursite
              </span>
              <span className="anim-blink font-mono text-[11.5px] text-subtle-2">not retrieved</span>
            </div>
          </div>
          <h3 className="display mb-2 mt-[18px] text-[19px]">The shortlist forms without you</h3>
          <p className="text-[15px] leading-[1.55] text-muted">
            Ask any assistant about your category and you get about three names back. We fix the one thing keeping you off that list — whether it can read your site at all.
          </p>
        </Card>

        <Card radius="panel" shadow={5} lift className="p-6">
          <div className="edge flex items-center justify-center rounded-[14px] bg-coral px-4 py-[22px]">
            <span className="-rotate-[7deg] rounded-[10px] border-[3px] border-ink bg-white px-4 py-2 font-mono text-[30px] font-bold text-ink shadow-hard-3">403</span>
          </div>
          <h3 className="display mb-2 mt-[18px] text-[19px]">Nobody chose the block</h3>
          <p className="text-[15px] leading-[1.55] text-muted">
            One Cloudflare default turns away every AI client at once, and it has been running quietly since the day somebody enabled it. Thirty seconds tells you whether that is you.
          </p>
        </Card>

        <Card radius="panel" shadow={5} lift className="p-6">
          <div className="edge grid gap-2 rounded-[14px] bg-violet p-4">
            {FIX_FILES.map((name, i) => (
              <div key={name} className="anim-rise edge rounded-[9px] bg-white px-[11px] py-[6px] font-mono text-[12.5px] font-medium text-ink" style={{ ['--i' as string]: i }}>
                {name}
              </div>
            ))}
          </div>
          <h3 className="display mb-2 mt-[18px] text-[19px]">The fix is four files</h3>
          <p className="text-[15px] leading-[1.55] text-muted">We write them from your own pages. Upload the four, re-run the check, and watch the number move.</p>
        </Card>
      </div>
    </Container>
  );
}

const STEPS = [
  { n: '01', title: 'Paste your URL' },
  { n: '02', title: 'See what each one got' },
  { n: '03', title: 'Ship the fix pack' },
] as const;

const STATS = [
  { n: '5', label: 'AI clients requested per scan' },
  { n: '21', label: 'checks, each with a published weight' },
  { n: '30s', label: 'from URL to a shareable result page' },
  { n: '0', label: 'code you have to write' },
] as const;

function TheCheck() {
  return (
    <Container as="section" className="pt-20">
      <Card surface="ink" radius="panel-lg" shadow="violet-7" className="p-6 sm:p-11">
        <div className="mx-auto max-w-[600px] text-center">
          <PillEyebrow>The check [04]</PillEyebrow>
          <h2 className="display mt-3 text-[clamp(28px,3.6vw,42px)] leading-[1.07] tracking-[-0.03em] text-on-ink-light">
            <Copy k="stepsTitle" />
          </h2>
        </div>
        <div className="mt-[34px] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {STEPS.map((step, i) => (
            <Card key={step.n} radius="card-lg" shadow="lime-4" lift className="p-6">
              <span className="edge inline-block rounded-[8px] bg-lime px-[9px] py-[2px] font-mono text-[12px] font-bold">{step.n}</span>
              <h3 className="display mb-2 mt-[13px] text-[19px]">{step.title}</h3>
              <p className="text-[14.5px] leading-[1.6] text-muted">
                <CopyItem k="steps" i={i as 0 | 1 | 2} />
              </p>
            </Card>
          ))}
        </div>
        <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-[18px] border-t-2 border-ink-2 pt-7">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="display m-0 text-[36px] tracking-[-0.03em] text-lime">{s.n}</dd>
              <dd className="m-0 mt-[5px] text-[13.5px] leading-[1.45] text-on-ink-label">{s.label}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Container>
  );
}

function ClosingCta() {
  return (
    <Container as="section" className="pb-[100px] pt-20">
      <div className={cx('edge rounded-[26px] bg-white px-6 py-[52px] text-center sm:px-10')}>
        <h2 className="display text-[clamp(30px,4.2vw,50px)] leading-[1.05] tracking-[-0.03em]">Find out in thirty seconds</h2>
        <p className="mx-auto mt-[14px] max-w-[46ch] text-[16.5px] leading-[1.55] text-muted">
          <Copy k="ctaBody" />
        </p>
        <Button href="/#check" tone="ink" size="lg" shadow={3} weight={700} className="mt-[26px] px-7 text-[16px]">
          Run the free check
        </Button>
      </div>
    </Container>
  );
}
