import type { Metadata } from 'next';
import Link from 'next/link';

import { ScanForm } from '@/components/ScanForm';
import { Transcript } from '@/components/Transcript';
import { ButtonLink, Eyebrow, Footer, Measure, Nav, SectionHeading, Shell } from '@/components/primitives';
import { LIMITS } from '@/lib/site';

export const metadata: Metadata = {
  description:
    'Your site answers browsers. It might be hanging up on agents. We request your page as five different clients, compare what each one gets back, and hand you the files that fix the gaps.',
};

/**
 * The hero is the thesis: the same request twice, and the disagreement
 * between the two answers. It is a demonstration rather than a claim, which is
 * the difference between this page and every audit tool's gradient headline.
 */
export default function LandingPage() {
  return (
    <Shell>
      <Nav action={<ButtonLink href="/index/saas" tone="ghost" size="sm">The index</ButtonLink>} />

      <main id="main">
        <Measure as="section" wide className="pb-12 pt-10 sm:pt-16">
          <Eyebrow>HTTP/1.1 200 OK for you · HTTP/1.1 403 Forbidden for them</Eyebrow>
          <h1 className="display-hero mt-5 max-w-[15ch] text-[42px] sm:text-[64px] lg:text-[76px]">
            Your site answers browsers. It might be <span className="text-fail">hanging up</span> on
            agents.
          </h1>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-end">
            <p className="max-w-[46ch] text-[17px] leading-[1.5] text-ink-60 sm:text-[18px]">
              We request your page as five different clients, compare what each one gets back, and
              hand you the exact files that fix the gaps.
            </p>
            <ScanForm autoFocus />
          </div>
        </Measure>

        <Measure wide>
          <Transcript
            animate
            example
            host="linear.app"
            left={{
              client: 'As a browser',
              userAgent: 'Mozilla/5.0 (Macintosh) … Chrome/141.0',
              status: 200,
              headers: [
                ['content-type', 'text/html; charset=utf-8'],
                ['server', 'cloudflare'],
              ],
              body: [
                'Linear is a purpose-built tool for planning and',
                'building products. Streamline issues, projects,',
                'and product roadmaps. Pricing: Free, Basic $8,',
                'Business $14, Enterprise …',
              ],
              chars: 9240,
            }}
            right={{
              client: 'As a reading agent',
              userAgent: 'ClaudeBot/1.0',
              status: 403,
              headers: [
                ['content-type', 'text/html'],
                ['server', 'cloudflare'],
                ['cf-mitigated', 'challenge'],
              ],
              body: [],
              chars: 312,
            }}
          />
        </Measure>

        <Measure as="section" wide className="mt-16 sm:mt-24">
          <SectionHeading kicker="Three passes, about thirty seconds">
            What the check actually does
          </SectionHeading>
          <dl className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-3">
            <Pass
              request="GET / × 5 clients"
              title="The same URL, five ways"
              body="Once as Chrome and once as each of ClaudeBot, GPTBot, PerplexityBot and Google-Extended, recording the status, headers and byte count each got back. Same URL, same second."
            />
            <Pass
              request="raw HTML vs rendered DOM"
              title="Text with and without JavaScript"
              body="The readable text is extracted from the plain response and from a headless render by the same algorithm. The ratio between them is how much of your page only exists once a script has run."
            />
            <Pass
              request="GET /robots.txt, /llms.txt, /.well-known/…"
              title="The paths agents look for first"
              body="robots.txt, sitemap.xml, llms.txt, llms-full.txt and the agent manifests, checked for existence, parseability, and links that actually resolve."
            />
          </dl>
          <p className="mono mt-10 max-w-[72ch] text-[12.5px] leading-[1.7] text-ink-60">
            {LIMITS.maxPagesPerScan} pages at most, sequential, {LIMITS.pageDelayMs / 1000} second
            apart. We identify as BotreadyBot/1.0 and obey your robots.txt. If your site refuses us,
            we record it as refused and show it that way rather than working around it.{' '}
            <Link href="/what-we-check" className="underline">
              The weights are published.
            </Link>
          </p>
        </Measure>
      </main>

      <Footer />
    </Shell>
  );
}

function Pass({ request, title, body }: { request: string; title: string; body: string }) {
  return (
    <div>
      <dt>
        <p className="mono text-[12px] text-ink-60">{request}</p>
        <p className="mt-1.5 text-[17px] font-semibold">{title}</p>
      </dt>
      <dd className="mt-2 text-[14.5px] leading-[1.55] text-ink-60">{body}</dd>
    </div>
  );
}
