import type { Metadata } from 'next';

import { ScanForm } from '@/components/ScanForm';
import { TwoReaders } from '@/components/TwoReaders';
import { ButtonLink, Eyebrow, Footer, Nav } from '@/components/primitives';
import { LIMITS } from '@/lib/site';

export const metadata: Metadata = {
  description:
    'Your site answers browsers. It might be hanging up on agents. We request your page as five different clients, compare what each one gets back, and hand you the files that fix the gaps.',
};

export default function LandingPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav action={<ButtonLink href="/index/saas" tone="ghost" size="sm">The index</ButtonLink>} />

      <main id="main">
        <section className="px-5 pb-10 pt-12 sm:px-7 sm:pt-16">
          <Eyebrow>HTTP 200 for you · HTTP 403 for them</Eyebrow>
          <h1
            className="max-w-[17ch] font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[52px]"
            style={{ fontVariationSettings: "'wdth' 108" }}
          >
            Your site answers browsers. It might be <em className="not-italic text-fail">hanging up</em> on
            agents.
          </h1>
          <p className="mt-[18px] max-w-[52ch] text-[17px] text-ink-60">
            We request your page as five different clients, compare what each one gets back, and
            hand you the exact files that fix the gaps.
          </p>

          <ScanForm autoFocus />
        </section>

        <TwoReaders
          example
          left={{
            heading: 'What Chrome gets',
            who: 'Mozilla/5.0 … Chrome/141',
            chars: 9240,
            status: 200,
            verdict: '200 OK · pricing found · 8 headings',
          }}
          right={{
            heading: 'What a plain fetch gets',
            who: 'ClaudeBot/1.0',
            chars: 312,
            status: 403,
            verdict: '403 Forbidden · nothing readable',
          }}
        />

        <section className="px-5 py-12 sm:px-7">
          <h2 className="display text-[26px] font-extrabold sm:text-h2">
            What the check actually does
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <Step
              n="Pass A"
              title="Five clients, one URL"
              body={`We fetch your page once as Chrome and once as each of ClaudeBot, GPTBot, PerplexityBot and Google-Extended, and record the status, headers and byte count each one got back. Same URL, same second.`}
            />
            <Step
              n="Pass B"
              title="Raw text against rendered text"
              body="We extract the readable text from the plain response and from a headless render with the same algorithm, then report how much of your page only exists once JavaScript has run."
            />
            <Step
              n="Pass C"
              title="The paths agents look for"
              body="robots.txt, sitemap.xml, llms.txt, llms-full.txt and the .well-known manifests, checked for existence, parseability and links that actually resolve."
            />
          </div>
          <p className="mt-8 max-w-[70ch] font-data text-[12.5px] text-ink-60">
            {LIMITS.maxPagesPerScan} pages at most, sequential, {LIMITS.pageDelayMs / 1000} second
            apart. We identify as BotreadyBot/1.0 and obey your robots.txt. If your site refuses
            us, we record it as refused and show it that way rather than working around it.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t border-ink pt-4">
      <p className="font-data text-[11px] font-bold uppercase tracking-[0.1em] text-ink-60">{n}</p>
      <h3 className="mt-1.5 text-[16px] font-semibold">{title}</h3>
      <p className="mt-2 text-[14px] text-ink-60">{body}</p>
    </div>
  );
}
