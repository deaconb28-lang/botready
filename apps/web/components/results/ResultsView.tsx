import { Suspense } from 'react';
import Link from 'next/link';

import {
  buildFixPack,
  catalog,
  type CheckResult,
  type Effort,
  type Finding,
  type FixPack,
  type PerAgentFetch,
  type ScoreDetail,
} from '@botready/core';

import { FindingsList } from './FindingsList';
import { FixPackPreview } from './FixPackPreview';
import { FixPackButton } from './FixPackButton';
import { ClientPanel } from './ClientPanel';
import { SitePanel } from './SitePanel';
import { SitePanelAsync, SitePanelSkeleton } from './SitePanelAsync';
import { ReportHeader } from './ReportHeader';
import { Button, Card, Container, TerminalLine, cx } from '@/components/ui';
import { PRICING } from '@/lib/site';
import { siteIdentity } from '@/lib/site-identity';
import { CLIENT_NAMES } from '@/lib/theme';

/**
 * The result page's body. Shared by /scan/[id], /r/[domain] and the fixture
 * preview, so what is on screen in one is what is on screen in the others.
 */
export function ResultsView({
  scanId,
  domain,
  url,
  checkedLabel,
  score,
  results,
  findings,
  pagesCrawled,
  scannerVersion,
  owned,
  fixture = false,
}: {
  scanId: string;
  domain: string;
  url: string;
  checkedLabel: string;
  score: ScoreDetail;
  results: CheckResult[];
  findings: Finding[];
  pagesCrawled: number;
  scannerVersion: string | null;
  owned: boolean;
  fixture?: boolean;
}) {
  const observedByKey = new Map(results.map((r) => [r.key, r.observed]));
  const items = findings.map((finding) => ({ finding, observed: observedByKey.get(finding.key) ?? {} }));
  const { plain, tech } = summaries(results, findings, score);
  const pack = buildFixPack(domain, results);
  const identity = siteIdentity(results, domain, url);
  const ledger = packLedger(pack);
  const errored = score.erroredChecks.length;

  // Two of these on the page, on two different grounds. Violet on white is the
  // loudest thing on the result; inside the violet panel it would disappear,
  // so there it is lime.
  const action = fixture ? (
    <Button href="/pricing" tone="violet" size="lg" shadow="lime-6" weight={700} className="text-[15.5px]">
      Get the fix pack — {PRICING.fixpack.label}
    </Button>
  ) : (
    <FixPackButton scanId={scanId} owned={owned} />
  );

  const panelAction = fixture ? (
    <Button href="/pricing" tone="lime" size="lg" shadow={4} weight={700} className="text-[15.5px]">
      Get the fix pack — {PRICING.fixpack.label}
    </Button>
  ) : (
    <FixPackButton scanId={scanId} owned={owned} on="violet" />
  );

  return (
    <Container as="section" width={1120} className="pb-24 pt-11">
      <h1 className="sr-only">
        Agent readability for {domain}: grade {score.grade}, {score.total} out of 100
      </h1>
      <div className="font-mono text-[12.5px] text-subtle-2">
        <span className="text-ink">{stripScheme(url)}</span> · {checkedLabel} · {pagesCrawled} {pagesCrawled === 1 ? 'page' : 'pages'}
      </div>

      <ReportHeader
        total={score.total}
        grade={score.grade}
        scoringVersion={score.scoringVersion}
        summaryPlain={plain}
        summaryTech={tech}
        categories={score.categories.map((c) => ({ key: c.key, label: c.label, pct: c.score }))}
        action={action}
      />

      {errored > 0 ? (
        <p className="mt-4 font-mono text-[12.5px] leading-[1.6] text-subtle-2">
          {errored} {errored === 1 ? 'check' : 'checks'} could not run and {errored === 1 ? 'is' : 'are'} counted as zero in the total. Nothing about{' '}
          {domain} is implied by {errored === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      <div className="mt-[34px] grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {/* The answer before the list of problems. The findings are the
              evidence and they are long; a reader who scrolls all of them
              before meeting the pack has already decided the page is a
              complaint. Leading with what is written for them makes the
              findings read as the receipt for it. */}
          <Card surface="violet" radius="panel" shadow={5} className="p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-[260px] flex-1">
                <h2 className="display text-[22px] text-white">Already written for {domain}</h2>
                <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.55] text-on-violet">
                  {ledger.covered} of your {ledger.total} findings have a file below with your own URLs in it. The rest are a
                  punch list ordered by effort, and a prompt that applies the lot one commit at a time.
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                  <div>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-on-violet-2">By hand</dt>
                    <dd className="m-0 display text-[19px] text-white">{ledger.byHand}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-on-violet-2">In the pack</dt>
                    <dd className="m-0 display text-[19px] text-white">
                      {pack.files.length + 2} files, {ledger.lines} lines
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-on-violet-2">Points it addresses</dt>
                    <dd className="m-0 display text-[19px] text-white">{ledger.pointsLabel(100 - score.total)}</dd>
                  </div>
                </dl>
              </div>
              <div className="grid min-w-[240px] gap-3">
                <TerminalLine>$ claude &quot;apply botready-fixes.md&quot;</TerminalLine>
                {panelAction}
              </div>
            </div>

            {/* The files themselves. The page has always generated these and
                shown only their names, which is why the price read as vague:
                everything above argues the problem is real and nothing showed
                that the answer is already written. */}
            <div className="mt-6">
              <FixPackPreview files={pack.files} domain={domain} />
            </div>
          </Card>

          <div className="mt-9">
            <FindingsList items={items} pointsMissing={100 - score.total} />
          </div>

          <ScanFacts url={url} pagesCrawled={pagesCrawled} scannerVersion={scannerVersion} scoringVersion={score.scoringVersion} checkCount={results.length} />
        </div>

        {/* The right column reads top to bottom as one argument: here is what
            five clients received for this URL, and here is the thing they were
            asking for. Both stick together so the comparison stays on screen
            while the findings scroll. */}
        <div className="grid gap-[18px] lg:sticky lg:top-[88px]">
          <ClientPanel results={results} sticky={false} />
          {/* The fixture names a domain that does not exist, so there is
              nothing to look at and nothing to wait for. */}
          {fixture ? (
            <SitePanel identity={identity} fixture />
          ) : (
            <Suspense fallback={<SitePanelSkeleton identity={identity} />}>
              <SitePanelAsync identity={identity} />
            </Suspense>
          )}
        </div>
      </div>
    </Container>
  );
}

/**
 * What the pack is worth, in the three units a reader actually weighs: how much
 * of their own list it covers, what doing it by hand costs, and how much of the
 * missing score it addresses.
 *
 * Every number comes from the punch list the pack already carries. The effort
 * words are the punch list's own — minutes, hours, days — rather than an
 * invented hour count, because we know which bucket each job is in and we do
 * not know how fast anyone works.
 */
function packLedger(pack: FixPack): {
  total: number;
  covered: number;
  byHand: string;
  lines: number;
  points: number;
  pointsLabel: (missing: number) => string;
} {
  const items = pack.punchList;
  const covered = items.filter((i) => i.file).length;
  const counts: Record<Effort, number> = { minutes: 0, hours: 0, days: 0 };
  for (const item of items) counts[item.effort] += 1;

  const parts = (['days', 'hours', 'minutes'] as const)
    .filter((e) => counts[e] > 0)
    .map((e) => `${counts[e]} × ${e}`);

  const lines =
    pack.files.reduce((n, f) => n + f.content.split('\n').length, 0) + pack.agentPrompt.split('\n').length;

  const points = Math.round(items.reduce((n, i) => n + i.pointsRecovered, 0));

  return {
    total: items.length,
    covered,
    byHand: parts.join(', ') || 'nothing outstanding',
    lines,
    points,
    /**
     * The punch list covers every check that did not pass, so its points can
     * round to slightly more than the score is missing — a warn earns half and
     * the item offers the whole. Printing "51 of 50" on the panel that has to
     * look trustworthy is worse than printing the true ceiling, which is that
     * it addresses all of it.
     */
    pointsLabel: (missing: number) => (points >= missing ? `all ${missing}` : `${points} of ${missing}`),
  };
}

/**
 * One sentence of fact for the header, in each register. Drawn from the parity
 * check when it failed, and from the worst finding otherwise. Never a summary
 * judgement.
 */
function summaries(results: CheckResult[], findings: Finding[], score: ScoreDetail): { plain: string; tech: string } {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const control = String(parity?.observed.control ?? 'chrome');
  const agents = Object.entries(perAgent).filter(([id]) => id !== control);
  const refused = agents.filter(([, v]) => v.status >= 400 || v.status === 0 || Boolean(v.transport_error));
  const parityLost = findings.find((f) => f.key === 'agent_status_parity')?.pointsLost ?? 0;
  const missing = 100 - score.total;

  if (refused.length > 0) {
    const most = missing > 0 && parityLost / missing >= 0.5;
    return {
      plain: `${wordNumber(refused.length)} of the ${wordNumber(agents.length + 1)} AI clients can't read this page at all.${most ? " That's most of the missing points." : ''}`,
      tech: `${refused.length} of ${agents.length} declared agent clients receive a non-200 status class from the Chrome-control URL.`,
    };
  }
  const worst = findings[0];
  if (!worst) {
    return {
      plain: `Every one of the ${catalog.checks.length} checks passed. The assistants your customers ask can read this page.`,
      tech: `${results.length} checks emitted, none failing, at scoring v${score.scoringVersion}.`,
    };
  }
  return {
    // The headlines in finding-copy.ts are written without terminal
    // punctuation, because most of the places they appear are their own line.
    // Here one runs into the next sentence.
    plain: `${sentence(worst.headline)} That is the biggest thing between you and a better grade.`,
    tech: `${worst.key} — ${worst.status}, costing ${worst.pointsLost} points. ${findings.length} ${findings.length === 1 ? 'check' : 'checks'} did not pass.`,
  };
}

/** End a headline so the sentence after it does not run into it. */
function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

function wordNumber(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n] ?? String(n);
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
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
  const facts: Array<[string, string]> = [
    ['url requested', url],
    ['pages read', `${pagesCrawled} of 6 allowed`],
    ['checks emitted', String(checkCount)],
    ['clients', String(catalog.agents.length)],
    ['scanner', scannerVersion ?? 'unrecorded'],
    ['scoring', `v${scoringVersion}`],
  ];
  return (
    <section className="mt-8">
      <h2 className="eyebrow text-subtle-2">How this was measured</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b border-dashed border-divider py-[6px] font-mono text-[12.5px]">
            <dt className="shrink-0 text-subtle-2">{k}</dt>
            <dd className="ml-auto m-0 min-w-0 truncate text-right text-ink" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[72ch] text-[13.5px] leading-[1.6] text-subtle-2">
        We read at most 6 pages a scan, sequentially, one second apart, and obey your robots.txt. <Link href="/what-we-check">The full catalog and the weights</Link>{' '}
        are published, and <Link href="/bot">blocking us</Link> takes one line.
      </p>
    </section>
  );
}

/**
 * A blocked or errored scan. Still a result page with a URL people can share,
 * because "this site refuses our scanner" is a finding.
 */
export function UnscoredView({
  domain,
  url,
  checkedLabel,
  status,
  message,
  results,
}: {
  domain: string;
  url: string;
  checkedLabel: string;
  status: string;
  message: string | null;
  results: CheckResult[];
}) {
  const blocked = status === 'blocked';
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  return (
    <Container as="section" width={1120} className="pb-24 pt-11">
      <h1 className="sr-only">
        {domain}: {blocked ? 'this site refuses our scanner' : 'the scan could not finish'}
      </h1>
      <div className="font-mono text-[12.5px] text-subtle-2">
        <span className="text-ink">{stripScheme(url)}</span> · {checkedLabel}
      </div>
      <div className={cx('edge mt-[18px] overflow-hidden rounded-[24px] bg-white')}>
        <div className={cx('flex flex-wrap items-center gap-6 border-b-2 border-ink px-6 py-[30px] sm:px-8', blocked ? 'bg-coral' : 'bg-amber')}>
          <span className="display-tight text-[64px] leading-none">{blocked ? '403' : '—'}</span>
          <div className="min-w-[240px] flex-1">
            <h2 className="display text-[24px]">{blocked ? 'This site refuses our scanner.' : 'The scan could not finish.'}</h2>
            <p className="mt-2 max-w-[60ch] text-[15.5px] leading-[1.5] text-ink">
              {message ?? (blocked ? 'We were refused and stopped there.' : 'Something went wrong on our side rather than on yours.')}
            </p>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-6 text-[15px] leading-[1.6] text-muted sm:px-8">
          {blocked ? (
            <>
              <p>
                We identify as <span className="font-mono text-ink">BotreadyBot/1.0</span> and we do not work around a refusal: no second request under another user agent,
                no proxy, no captcha solving. There is no score because we have not measured enough to produce one, and inventing a number from a refusal would be worse
                than leaving it out.
              </p>
              <p>
                Most refusals we see are a bot-protection rule that nobody chose, matching on any user agent that is not a browser. If you own this site and want it
                measured, allow <span className="font-mono text-ink">BotreadyBot</span> at your edge and <Link href="/#check">run the check again</Link>. If the refusal is
                deliberate, that is a legitimate answer and we will keep recording it as one.
              </p>
            </>
          ) : (
            <p>
              The scan started and did not finish. {message ? '' : 'No reason was recorded.'} <Link href="/#check">Run it again</Link> — if it keeps failing, the problem is
              ours rather than yours.
            </p>
          )}
          <p className="font-mono text-[12.5px] text-subtle-2">
            {results.length} {results.length === 1 ? 'check' : 'checks'} completed before we stopped
            {Object.keys(perAgent).length > 0 ? ` · ${Object.keys(perAgent).map((id) => CLIENT_NAMES[id] ?? id).join(', ')} asked` : ''}
          </p>
        </div>
      </div>
    </Container>
  );
}
