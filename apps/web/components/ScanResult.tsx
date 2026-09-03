/**
 * The result page's body, apart from the nav and the footer.
 *
 * Extracted so that the fixture preview at /preview/[fixture] renders the exact
 * same components as /scan/[id] does. The order is the order a reader needs
 * the facts in:
 *
 *   the band       the grade, and the five status lines beside it
 *   the strip      six categories, one measurement with six parts
 *   the transcript the same page as two readers, with this scan's numbers
 *   the findings   worst first, with the raw evidence under each
 *   the fix pack   a real file, cut off
 *   what works     one line each
 *   how measured   the facts about the scan itself
 */

import Link from 'next/link';

import { buildFixPack, findings as findingsOf } from '@botready/core';
import type { CheckResult, Finding, ScoreDetail } from '@botready/core';

import { CategoryStrip } from '@/components/CategoryCards';
import { Findings, Passing } from '@/components/Findings';
import { GradeBand, StatusBand } from '@/components/GradeBlock';
import { Paywall } from '@/components/Paywall';
import { Transcript } from '@/components/Transcript';
import { WhoGetsIn, transcriptFrom } from '@/components/WhoGetsIn';
import { Measure, Microcopy, SectionHeading } from '@/components/primitives';

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

  const transcript = transcriptFrom(results, url);
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

      <GradeBand
        domain={domain}
        checkedAt={checkedAt}
        grade={score.grade}
        total={score.total}
        scoringVersion={score.scoringVersion}
        verdict={verdictFor(results, findings)}
        aside={<WhoGetsIn results={results} />}
      />

      <Measure wide className="pt-8">
        {errored > 0 ? (
          <p className="wire-line mb-6 border-l-[3px] border-server pl-4 text-ink-60">
            {errored} {errored === 1 ? 'check' : 'checks'} could not run and{' '}
            {errored === 1 ? 'is' : 'are'} counted as zero in the total. Nothing about {domain} is
            implied by {errored === 1 ? 'it' : 'them'}; {errored === 1 ? 'it is' : 'they are'} marked
            below.
          </p>
        ) : null}

        <CategoryStrip categories={score.categories} />

        {transcript ? (
          <section className="mt-14">
            <SectionHeading kicker="The same page, two readers">
              What a browser got, and what a plain fetch got
            </SectionHeading>
            <p className="mt-3 max-w-[64ch] text-[15px] text-ink-60">
              Readable characters extracted by the same algorithm from the response your server
              sent, and from the same page after a browser ran it.
            </p>
            <div className="mt-6">
              <Transcript host={transcript.host} path={transcript.path} left={transcript.left} right={transcript.right} />
            </div>
          </section>
        ) : null}

        <Findings findings={findings} pointsLostTotal={100 - score.total} />
      </Measure>

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

      <Measure wide>
        <Passing passing={passing} />
        <ScanFacts
          url={url}
          pagesCrawled={pagesCrawled}
          scannerVersion={scannerVersion}
          scoringVersion={score.scoringVersion}
          checkCount={results.length}
        />
      </Measure>
    </>
  );
}

/**
 * One sentence of fact for the band, taken from the worst finding. Never a
 * summary judgement: the reader can see the grade, and what they cannot see is
 * which measurement produced it.
 */
function verdictFor(results: CheckResult[], findings: Finding[]): string {
  const parity = findings.find((f) => f.key === 'agent_status_parity');
  if (parity && parity.status === 'fail') {
    const perAgent = (results.find((r) => r.key === 'agent_status_parity')?.observed.per_agent ?? {}) as Record<
      string,
      { status: number }
    >;
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
    <section className="mt-14">
      <SectionHeading kicker="The scan itself">How this was measured</SectionHeading>
      <dl className="wire-line mt-5 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <Fact label="url requested" value={url} />
        <Fact label="pages read" value={`${pagesCrawled} of 6 allowed`} />
        <Fact label="checks emitted" value={String(checkCount)} />
        <Fact label="scanner" value={scannerVersion ?? 'unrecorded'} />
        <Fact label="scoring" value={`v${scoringVersion}`} />
        <Fact label="user agent" value="BotreadyBot/1.0" />
      </dl>
      <Microcopy className="mt-5 max-w-[72ch] leading-[1.7]">
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
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-dashed border-rule py-1.5">
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

      <StatusBand
        domain={domain}
        checkedAt={checkedAt}
        headline={blocked ? 'This site refuses our scanner.' : 'The scan could not finish.'}
        detail={
          message ??
          (blocked ? 'We were refused and stopped there.' : 'Something went wrong on our side rather than on yours.')
        }
        tone={blocked ? 'fail' : 'warn'}
      />

      <Measure wide className="pt-8">
        <SectionHeading kicker="What we did">
          {blocked ? 'Asked once, and stopped' : 'Started, and did not finish'}
        </SectionHeading>
        <p className="mt-3 max-w-[66ch] text-[15px] leading-[1.55] text-ink-60">
          {blocked ? (
            <>
              We identify as <span className="mono">BotreadyBot/1.0</span> and we do not work around
              a refusal: no second request under another user agent, no proxy, no captcha solving.
              There is no score because we have not measured enough to produce one, and inventing a
              number from a refusal would be worse than leaving it out.
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

        {partial.length > 0 ? <Findings findings={partial} pointsLostTotal={0} /> : null}

        {blocked ? (
          <section className="mt-14">
            <SectionHeading kicker="If this was not deliberate">Allow BotreadyBot and run it again</SectionHeading>
            <p className="mt-3 max-w-[66ch] text-[15px] leading-[1.55] text-ink-60">
              Most refusals we see are a bot-protection rule that nobody chose, matching on any user
              agent that is not a browser. If you own this site and want it measured, allow{' '}
              <span className="mono">BotreadyBot</span> at your edge and run the check again. If the
              refusal is deliberate, that is a legitimate answer and we will keep recording it as one.
            </p>
          </section>
        ) : null}
      </Measure>
    </>
  );
}

// ------------------------------------------------------------------ formatting

export function formatUtc(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${date.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' },
  )} UTC`;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
