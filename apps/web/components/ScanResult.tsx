/**
 * The result page's body, apart from the page shell.
 *
 * Extracted so that the fixture preview at /preview/[fixture] renders the exact
 * same components as /scan/[id] does. A preview that renders its own version of
 * the page is a preview of nothing, and the awkward case this page has to get
 * right — a scan where some checks errored — is one a real scan produces rarely
 * and a fixture produces on demand.
 */

import Link from 'next/link';

import { buildFixPack, findings as findingsOf } from '@botready/core';
import type { CheckResult, Finding, ScoreDetail } from '@botready/core';

import { CategoryCards } from '@/components/CategoryCards';
import { Findings, Passing } from '@/components/Findings';
import { GradeBlock, StatusBlock } from '@/components/GradeBlock';
import { Paywall } from '@/components/Paywall';
import { TwoReaders } from '@/components/TwoReaders';
import { WhoGetsIn, readerSidesFrom } from '@/components/WhoGetsIn';
import { Card, CardHeading, Microcopy } from '@/components/primitives';

// ------------------------------------------------------------------ complete

export function CompleteResult({
  id,
  domain,
  url,
  checkedAt,
  score,
  results,
  findings,
  passing,
  pagesCrawled,
  scannerVersion,
  owned,
}: {
  id: string;
  domain: string;
  url: string;
  checkedAt: string;
  score: ScoreDetail | null;
  results: CheckResult[];
  findings: Finding[];
  passing: Finding[];
  pagesCrawled: number;
  scannerVersion: string | null;
  owned: boolean;
}) {
  if (!score) return null;

  const readers = readerSidesFrom(results);
  const fixPack = buildFixPack(domain, results);
  const preview =
    fixPack.files.find((f) => f.name === 'llms.txt' && !f.incomplete) ??
    fixPack.files.find((f) => !f.incomplete) ??
    fixPack.files[0];

  const errored = score.erroredChecks.length;

  return (
    <>
      <h1 className="sr-only">
        Agent readability for {domain}: grade {score.grade}, {score.total} out of 100
      </h1>

      <div className="grid grid-cols-1 items-stretch gap-[22px] lg:grid-cols-[1.15fr_1fr]">
        <GradeBlock
          domain={domain}
          checkedAt={checkedAt}
          grade={score.grade}
          total={score.total}
          scoringVersion={score.scoringVersion}
          verdict={verdictFor(results, findings)}
        />
        <WhoGetsIn results={results} />
      </div>

      {errored > 0 ? (
        <p className="mt-4 rounded-[5px] border border-server border-l-[3px] bg-card px-[18px] py-3 font-data text-[12.5px] text-ink-60">
          {errored} {errored === 1 ? 'check' : 'checks'} could not run, and{' '}
          {errored === 1 ? 'it is' : 'they are'} counted as zero in the total. Nothing about{' '}
          {domain} is implied by {errored === 1 ? 'it' : 'them'} — the{' '}
          {errored === 1 ? 'check' : 'checks'} in question{' '}
          {errored === 1 ? 'is' : 'are'} listed below and marked as such.
        </p>
      ) : null}

      <CategoryCards categories={score.categories} />

      {readers ? (
        <section className="mt-9">
          <h2 className="text-[20px] font-bold">The same page, two readers</h2>
          <p className="mt-0.5 mb-4 text-[14px] text-ink-60">
            Readable characters extracted by the same algorithm from the response your server
            sent, and from the same page after a browser ran it.
          </p>
          <TwoReaders left={readers.left} right={readers.right} />
        </section>
      ) : null}

      <Findings findings={findings} pointsLostTotal={100 - score.total} />

      {preview ? (
        <Paywall
          scanId={id}
          domain={domain}
          preview={preview}
          punchList={fixPack.punchList}
          fileCount={fixPack.files.length}
          owned={owned}
        />
      ) : null}

      <Passing passing={passing} />

      <ScanFacts
        url={url}
        pagesCrawled={pagesCrawled}
        scannerVersion={scannerVersion}
        scoringVersion={score.scoringVersion}
        checkCount={results.length}
      />
    </>
  );
}

/**
 * One sentence of fact for the header block, taken from the worst finding. Never
 * a summary judgement: the reader can see the grade, and what they cannot see is
 * which measurement produced it.
 */
function verdictFor(
  results: CheckResult[],
  findings: Finding[],
): string {
  const parity = findings.find((f) => f.key === 'agent_status_parity');
  if (parity && parity.status === 'fail') {
    const perAgent = (results.find((r) => r.key === 'agent_status_parity')?.observed.per_agent ??
      {}) as Record<string, { status: number }>;
    const total = Object.keys(perAgent).length;
    const refused = Object.values(perAgent).filter((f) => f.status >= 400).length;
    return `${refused} of ${total} clients cannot read this page at all`;
  }

  const worst = findings[0];
  if (!worst) return 'every check in the catalog passed';
  return lower(worst.headline);
}

function ScanFacts({
  url,
  pagesCrawled,
  scannerVersion,
  scoringVersion,
  checkCount,
}: {
  url: string;
  pagesCrawled: number;
  scannerVersion: string | null;
  scoringVersion: string;
  checkCount: number;
}) {
  return (
    <Card as="section" className="mt-9">
      <CardHeading>How this was measured</CardHeading>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 font-data text-[12.5px] sm:grid-cols-2">
        <Fact label="url requested" value={url} />
        <Fact label="pages read" value={`${pagesCrawled} of 6 allowed`} />
        <Fact label="checks emitted" value={String(checkCount)} />
        <Fact label="scanner" value={scannerVersion ?? 'unrecorded'} />
        <Fact label="scoring" value={`v${scoringVersion}`} />
        <Fact label="user agent" value="BotreadyBot/1.0" />
      </dl>
      <Microcopy className="mt-4">
        We read at most 6 pages a scan, sequentially, one second apart, and obey your robots.txt.{' '}
        <Link href="/what-we-check" className="underline">
          The full catalog and the weights
        </Link>{' '}
        are published, and{' '}
        <Link href="/bot" className="underline">
          blocking us
        </Link>{' '}
        takes one line.
      </Microcopy>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-dashed border-rule py-1.5">
      <dt className="shrink-0 text-ink-60">{label}</dt>
      <dd className="ml-auto min-w-0 truncate text-right text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

// ------------------------------------------------------------------ unscored

/**
 * A blocked or errored scan. Still a result page with a URL people can share,
 * because "this site refuses our scanner" is a finding and the index lists it
 * as one.
 */
export function UnscoredResult({
  domain,
  url,
  checkedAt,
  status,
  message,
  results,
}: {
  domain: string;
  url: string;
  checkedAt: string;
  status: string;
  message: string | null;
  results: CheckResult[];
}) {
  const blocked = status === 'blocked';
  const partial = findingsOf(results);

  return (
    <>
      <h1 className="sr-only">
        {domain}: {blocked ? 'this site refuses our scanner' : 'the scan could not finish'}
      </h1>

      <StatusBlock
        domain={domain}
        checkedAt={checkedAt}
        headline={blocked ? 'This site refuses our scanner' : 'The scan could not finish'}
        detail={
          message ??
          (blocked
            ? 'We were refused and stopped there.'
            : 'Something went wrong on our side rather than on yours.')
        }
        tone={blocked ? 'fail' : 'warn'}
      />

      <Card as="section" className="mt-[22px]">
        <CardHeading>What we did</CardHeading>
        <p className="max-w-[70ch] text-[14px] text-ink-60">
          {blocked ? (
            <>
              We identify as <span className="font-data">BotreadyBot/1.0</span> and we do not work
              around a refusal: no second request under another user agent, no proxy, no captcha
              solving. There is no score below because we have not measured enough to produce one,
              and inventing a number from a refusal would be worse than leaving it out.
            </>
          ) : (
            <>
              The scan started and did not finish. {message ? '' : 'No reason was recorded.'} Run it
              again — if it keeps failing, the problem is ours rather than yours.
            </>
          )}
        </p>
        <Microcopy className="mt-4">
          {url} · {results.length} {results.length === 1 ? 'check' : 'checks'} completed before we
          stopped
        </Microcopy>
      </Card>

      {partial.length > 0 ? (
        <Findings findings={partial} pointsLostTotal={0} />
      ) : null}

      {blocked ? (
        <Card as="section" className="mt-9">
          <CardHeading>If this was not deliberate</CardHeading>
          <p className="max-w-[70ch] text-[14px] text-ink-60">
            Most refusals we see are a bot-protection rule that nobody chose, matching on any user
            agent that is not a browser. If you own this site and want it measured, allow{' '}
            <span className="font-data">BotreadyBot</span> at your edge and run the check again. If
            the refusal is deliberate, that is a legitimate answer and we will keep recording it as
            one.
          </p>
        </Card>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ formatting

export function formatUtc(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
