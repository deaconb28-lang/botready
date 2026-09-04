import type { Metadata } from 'next';
import Link from 'next/link';

import { catalog } from '@botready/core';

import { ArticleStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow, PageTitle, cx } from '@/components/ui';
import { pageFor } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import { CONTACT_EMAIL, LIMITS, SITE, USER_AGENT } from '@/lib/site';

const PAGE = pageFor('/docs')!;

export const metadata: Metadata = pageMetadata('/docs');

/** The machine-readable files, each of which is served by a route in this app. */
const FILES: Array<{ path: string; what: string }> = [
  { path: '/llms.txt', what: 'What this site is and where the readable version of every page lives.' },
  { path: '/llms-full.txt', what: 'Every public page inlined, so reading the whole site costs one request.' },
  { path: '/openapi.json', what: 'The two endpoints below, as OpenAPI 3.1.' },
  { path: '/.well-known/agent.json', what: 'What a client can do here, what it costs, and how our own crawler behaves.' },
  { path: '/.well-known/ai-plugin.json', what: 'The older manifest, pointing at the same OpenAPI description.' },
  { path: '/index.md', what: 'Any page with .md appended is that page as markdown. So is Accept: text/markdown.' },
  { path: '/sitemap.xml', what: 'Every public page, with the date its content actually changed.' },
  { path: '/robots.txt', what: 'Open to everything except the app, the account area and the API.' },
];

const FIELDS: Array<{ name: string; type: string; what: string }> = [
  { name: 'status', type: 'string', what: 'queued, running, complete or error.' },
  { name: 'settled', type: 'boolean', what: 'False while checks are still landing. Poll until it is true.' },
  { name: 'progress[]', type: '{ key, status }', what: 'Each check as it finishes, in the order the scan ran them.' },
  { name: 'score.total', type: 'integer', what: '0 to 100. Absent until settled.' },
  { name: 'score.grade', type: 'string', what: 'A to F, from the bands published on the catalog page.' },
  { name: 'score.categoryScores', type: 'object', what: 'Each of the six categories, 0 to 100 within itself.' },
  { name: 'score.failedChecks', type: 'string[]', what: 'The keys that failed. Every key exists in the catalog.' },
  { name: 'score.scoringVersion', type: 'string', what: 'The version of the weights that produced this total.' },
  { name: 'scannerVersion', type: 'string', what: 'The version of the crawler that gathered the evidence.' },
];

export default function DocsPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <ArticleStructuredData path="/docs" headline={PAGE.title} description={PAGE.description} updated={PAGE.updated} />
      <SiteHeader />
      <Container as="main" id="main" width={860} className="pb-24 pt-14">
        <PageTitle eyebrow="API and docs" size="xl">
          Everything here is machine-readable
        </PageTitle>
        <p className="mt-[18px] max-w-[62ch] text-[17.5px] leading-[1.6] text-muted">
          It would be difficult to sell a legibility check from a site an agent cannot read. So the scan API is public and needs no key,
          every page answers <code className="font-mono text-[15px]">Accept: text/markdown</code> with its own text, and the files below are
          the ones we tell everybody else to serve.
        </p>

        <H2>Start a scan</H2>
        <Pre>{`POST ${SITE.origin}/api/scan\ncontent-type: application/json\n\n{ "url": "https://example.com" }`}</Pre>
        <P className="mt-4">
          Answers <code className="font-mono text-[15px]">{`{ "scanId": "…", "cached": false, "domain": "example.com" }`}</code>. A result
          less than {LIMITS.cacheHours} hours old is returned instead of crawling again, with{' '}
          <code className="font-mono text-[15px]">cached: true</code> — the window exists so that a link to a result page cannot be turned
          into traffic against the site it describes.
        </P>

        <H2>Read it</H2>
        <Pre>{`GET ${SITE.origin}/api/scan/{scanId}`}</Pre>
        <P className="mt-4">
          Poll it. A scan settles in about thirty seconds, because {catalog.agents.length} clients a second apart and up to{' '}
          {LIMITS.maxPagesPerScan} pages a second apart is what a scan is. The fields that matter:
        </P>
        <Card radius="card-lg" shadow={4} className="mt-4 overflow-hidden">
          <ul className="m-0 list-none p-0">
            {FIELDS.map((field, i) => (
              <li
                key={field.name}
                className={cx(
                  'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-[22px] py-[13px]',
                  i < FIELDS.length - 1 && 'border-b border-hairline-2',
                )}
              >
                <span className="min-w-[168px] font-mono text-[13px] font-medium">{field.name}</span>
                <span className="min-w-[104px] font-mono text-[12px] text-placeholder">{field.type}</span>
                <span className="min-w-0 flex-1 text-[14.5px] leading-[1.5] text-muted">{field.what}</span>
              </li>
            ))}
          </ul>
        </Card>

        <H2>Rate limits</H2>
        <P>
          {LIMITS.anonymousScansPerHour} scans an hour from an address without an account, {LIMITS.signedInScansPerHour} with one. A{' '}
          <code className="font-mono text-[15px]">429</code> carries <code className="font-mono text-[15px]">retry-after</code> and the
          three <code className="font-mono text-[15px]">x-ratelimit-*</code> headers, and the message says which limit you hit rather than
          making you guess.
        </P>

        <H2>What this site serves</H2>
        <Eyebrow className="mb-3">Fetch any of these right now</Eyebrow>
        <Card radius="card-lg" shadow={4} className="overflow-hidden">
          <ul className="m-0 list-none p-0">
            {FILES.map((file, i) => (
              <li
                key={file.path}
                className={cx(
                  'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-[22px] py-[13px]',
                  i < FILES.length - 1 && 'border-b border-hairline-2',
                )}
              >
                <a href={file.path} className="min-w-[212px] font-mono text-[13px] font-medium">
                  {file.path}
                </a>
                <span className="min-w-0 flex-1 text-[14.5px] leading-[1.5] text-muted">{file.what}</span>
              </li>
            ))}
          </ul>
        </Card>

        <H2>Our crawler</H2>
        <P>
          When we read your site we do it as <code className="font-mono text-[15px]">{USER_AGENT}</code>, we read your robots.txt first, and
          we stop if it says to. <Link href="/bot">The crawler page</Link> is the whole of it, including the four things we will never do to
          get past a block. The catalog and the weights are on <Link href="/what-we-check">what we check</Link>, at scoring version{' '}
          {catalog.scoringVersion}.
        </P>
        <P className="mt-4">
          Something wrong, or something missing from the API? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> reaches somebody who
          can change it.
        </P>
      </Container>
      <SiteFooter />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display mb-3 mt-11 text-[30px] tracking-[-0.03em]">{children}</h2>;
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={cx('max-w-[64ch] text-[16.5px] leading-[1.65] text-muted', className)}>{children}</p>;
}

function Pre({ children }: { children: string }) {
  return (
    <pre
      tabIndex={0}
      className="edge overflow-auto rounded-[14px] bg-ink p-5 font-mono text-[13px] leading-[1.7] text-on-ink shadow-violet-5"
    >
      {children}
    </pre>
  );
}
