import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { findings, scoreDetail, type CheckResult } from '@botready/core';

import { ResultsView, UnscoredView } from '@/components/results/ResultsView';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Container } from '@/components/ui';

/**
 * The result page, rendered from a fixture instead of from the database.
 *
 * This is the "see an example result" link on the landing page, and the way
 * the awkward states can be looked at on demand: a scan where two checks
 * errored, a site that refuses us. The page renders through the identical
 * components, so what is on screen here is what a reader sees. Every fixture
 * says it is one.
 */

const FIXTURES = ['reference-a', 'reference-f', 'waf-blocked-spa', 'skips-and-errors', 'retrievable-but-undescribed'] as const;

export const metadata: Metadata = {
  title: 'Example result',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return FIXTURES.map((fixture) => ({ fixture }));
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ fixture: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { fixture } = await params;
  const { state } = await searchParams;
  if (!FIXTURES.includes(fixture as (typeof FIXTURES)[number])) notFound();

  const results = await loadFixture(fixture);
  const domain = 'yoursite.com';
  const unscored = state === 'blocked' || state === 'error';

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <Container width={1120} className="pt-8">
          <p role="status" className="edge rounded-[12px] bg-amber-tint px-4 py-3 font-mono text-[12.5px] leading-[1.5] text-ink">
            An example, not a measurement. This is the fixture <span className="font-bold">{fixture}</span>
            {unscored ? ` in its ${state} state` : ''}, rendered through the same page a real scan uses. Nothing here was fetched from yoursite.com.
          </p>
        </Container>
        {unscored ? (
          <UnscoredView
            domain={domain}
            url={`https://${domain}/`}
            checkedLabel="example"
            status={state === 'blocked' ? 'blocked' : 'error'}
            message={
              state === 'blocked'
                ? 'This site answers BotreadyBot with HTTP 403 (cf-mitigated: challenge). We record that as refused and do not work around it.'
                : 'We could not reach https://yoursite.com/. socket hang up'
            }
            results={results.slice(0, 3)}
          />
        ) : (
          <ResultsView
            scanId="example"
            domain={domain}
            url={`https://${domain}/`}
            checkedLabel="example"
            score={scoreDetail(results)}
            results={results}
            findings={findings(results)}
            pagesCrawled={6}
            scannerVersion="1.0.0"
            owned={false}
            fixture
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

async function loadFixture(name: string): Promise<CheckResult[]> {
  const path = join(process.cwd(), '..', '..', 'packages', 'core', '__fixtures__', `${name}.json`);
  return JSON.parse(await readFile(path, 'utf8')) as CheckResult[];
}
