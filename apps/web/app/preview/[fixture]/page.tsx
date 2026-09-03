import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { findings, passing, scoreDetail, type CheckResult } from '@botready/core';

import { CompleteResult, UnscoredResult, formatUtc } from '@/components/ScanResult';
import { ButtonLink, Footer, Measure, Nav, Shell } from '@/components/primitives';
import { isProduction } from '@/lib/env';

/**
 * The result page, rendered from a fixture instead of from the database.
 *
 * This exists so that the awkward states can be looked at on demand: a scan
 * where two checks errored, a category where everything was skipped, a site
 * that refuses us. The page renders through the identical components, so what
 * is on screen here is what a reader sees.
 *
 * Not available in production. A route that renders a fabricated result under
 * a URL that looks like a real one is exactly the thing this product exists to
 * complain about.
 */

const FIXTURES = ['reference-a', 'reference-f', 'waf-blocked-spa', 'skips-and-errors', 'retrievable-but-undescribed'] as const;

export const metadata: Metadata = {
  title: 'Fixture preview',
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
  if (isProduction()) notFound();

  const { fixture } = await params;
  const { state } = await searchParams;
  if (!FIXTURES.includes(fixture as (typeof FIXTURES)[number])) notFound();

  const results = await loadFixture(fixture);
  const checkedAt = formatUtc('2026-09-02T14:02:00Z');
  const domain = 'linear.app';
  const unscored = state === 'blocked' || state === 'error';

  return (
    <Shell>
      <Nav action={<ButtonLink href="/" size="sm">Check another site</ButtonLink>} />

      <main id="main">
        <Measure wide>
          <p role="status" className="wire-line mb-6 border-l-[3px] border-warn pl-4 text-ink">
            Fixture preview: {fixture}
            {unscored ? ` · ${state}` : ''}. Nothing here was measured. Available outside production only.
          </p>
        </Measure>

        {unscored ? (
          <UnscoredResult
            domain={domain}
            url={`https://${domain}/`}
            checkedAt={checkedAt}
            status={state === 'blocked' ? 'blocked' : 'error'}
            message={
              state === 'blocked'
                ? 'This site answers BotreadyBot with HTTP 403 (cf-mitigated: challenge). We record that as refused and do not work around it.'
                : 'We could not reach https://linear.app/. socket hang up'
            }
            results={results.slice(0, 3)}
          />
        ) : (
          <CompleteResult
            id="00000000-0000-4000-8000-000000000000"
            domain={domain}
            url={`https://${domain}/`}
            checkedAt={checkedAt}
            score={scoreDetail(results)}
            results={results}
            findings={findings(results)}
            passing={passing(results)}
            pagesCrawled={6}
            scannerVersion="1.0.0"
            owned={false}
          />
        )}
      </main>

      <Footer />
    </Shell>
  );
}

async function loadFixture(name: string): Promise<CheckResult[]> {
  const path = join(process.cwd(), '..', '..', 'packages', 'core', '__fixtures__', `${name}.json`);
  return JSON.parse(await readFile(path, 'utf8')) as CheckResult[];
}
