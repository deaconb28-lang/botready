'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { catalog, checkDef, type CheckStatus, type PerAgentFetch } from '@botready/core';

import { BotScene } from '@/components/bot/BotScene';
import { SiteFavicon, fallbackIcon } from '@/components/results/SiteFavicon';
import { Container, SoftChip, cx } from '@/components/ui';
import { CLIENT_IDS, formatInt } from '@/lib/theme';

/**
 * The wait is the demo.
 *
 * Every line in the log is a check the worker actually finished, read off the
 * same polling endpoint the result page uses. Nothing is simulated on a timer:
 * a line appears when the evidence row exists, the ring fills to the number of
 * checks that have landed, and a stage goes green when the check that could
 * only have run after it appears in the progress list. When the scan settles
 * the page moves to the result, where the score counts up.
 *
 * The motion — the sweep, the scanline, the radar, the caret — is decoration
 * over that number and says nothing on its own. Under prefers-reduced-motion
 * the sweep and the scanline are removed and everything else holds still; the
 * page is fully legible frozen, because the state is in the text.
 */

interface Poll {
  status: 'queued' | 'running' | 'complete' | 'blocked' | 'error';
  settled: boolean;
  domain: string;
  url: string;
  pagesCrawled: number;
  errorMessage: string | null;
  progress: Array<{ key: string; status: CheckStatus }>;
  /** Null until the parity check lands. Never a placeholder. */
  clients: { control: string; perAgent: Record<string, PerAgentFetch> } | null;
  score: { total: number; grade: string } | null;
}

const POLL_MS = 1200;
const GIVE_UP_MS = 180_000;

/**
 * What the worker is doing, and the check whose arrival proves it finished.
 *
 * These are not timers. Each stage is marked done when a check that could only
 * have run after that request appears in the progress list, so the sequence is
 * read off the scan rather than acted out beside it.
 */
const STAGES: Array<{ label: string; detail: string; provenBy: string }> = [
  { label: 'GET /robots.txt', detail: 'First, always. If it disallows us the scan ends here.', provenBy: 'robots_present' },
  {
    label: 'GET /sitemap.xml, /llms.txt, /.well-known/…',
    detail: 'The files an agent looks for before it looks at your HTML.',
    provenBy: 'agent_manifest',
  },
  {
    label: `GET / as ${catalog.agents.length} clients`,
    detail: 'Sequentially, one second apart, from the same address.',
    provenBy: 'agent_status_parity',
  },
  { label: 'Render once, headless', detail: 'Images, fonts and media declined. Then compare the two texts.', provenBy: 'js_dependency_ratio' },
  { label: 'Read the linked pages', detail: 'Up to five more, pricing and docs first.', provenBy: 'title_meta_distinct' },
];

export function LiveScan({ scanId, next }: { scanId: string; next: string | null }) {
  const router = useRouter();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const settled = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled || settled.current) return;
      try {
        const response = await fetch(`/api/scan/${scanId}`, { cache: 'no-store' });
        if (!response.ok) {
          setError(
            response.status === 404
              ? 'That scan does not exist. Start another one from the home page.'
              : `The status endpoint answered ${response.status}. The scan may still be running.`,
          );
          return;
        }
        const body = (await response.json()) as Poll;
        if (cancelled) return;
        setPoll(body);

        if (body.settled) {
          settled.current = true;
          setTimeout(() => router.replace(next ?? `/scan/${scanId}`), 600);
          return;
        }
        if (Date.now() - startedAt.current > GIVE_UP_MS) {
          settled.current = true;
          setError('The scan has been running for three minutes, which is longer than any scan should take. The result page will show it when it finishes.');
        }
      } catch {
        if (!cancelled) setError('We lost the connection to the status endpoint. The scan is probably still running.');
      }
    }

    void tick();
    const poller = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => {
      cancelled = true;
      clearInterval(poller);
      clearInterval(clock);
    };
  }, [scanId, router, next]);

  const done = poll?.progress.length ?? 0;
  const total = catalog.checks.length;
  const percent = Math.min(96, Math.round((done / total) * 100));
  const landed = new Set(poll?.progress.map((entry) => entry.key) ?? []);
  const stageDone = STAGES.map((stage) => landed.has(stage.provenBy));
  // The first stage not yet proven is the one in flight. Once every stage is
  // proven, nothing is running but the last few document checks.
  const running = stageDone.indexOf(false);

  return (
    <Container width={1120} className="pb-24 pt-11">
      {/* The site, as itself, from the first frame. A loading screen that
          shows the reader their own icon is a loading screen about their
          site; one that says "your site" is a loading screen about us. */}
      <div className="flex items-center gap-[10px]">
        <SiteFavicon src={poll ? fallbackIcon(poll.url) : ''} domain={poll?.domain ?? '?'} size={20} />
        <div className="min-w-0 font-mono text-[12.5px] text-subtle-2">
          <span className="text-ink">{poll?.domain ?? 'your site'}</span> · reading as {catalog.agents.length} clients… ·{' '}
          <span className="tabular-nums">{elapsed}s</span>
        </div>
      </div>

      <div className="edge relative mt-[18px] overflow-hidden rounded-[24px] bg-white">
        {/* A sheen crossing the card. Decoration, and the first thing the
            reduced-motion block removes. */}
        <div
          aria-hidden="true"
          className="br-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-violet-chip to-transparent opacity-70"
        />
        <div className="relative flex flex-wrap items-center gap-8 border-b border-hairline px-6 py-[30px] sm:px-8">
          <ProgressRing done={done} total={total} />
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-[10px]">
              <span className="relative inline-flex h-[10px] w-[10px]" aria-hidden="true">
                <span className="br-halo absolute inset-0 rounded-full bg-violet" />
                <span className="anim-pulse-dot relative inline-block h-[10px] w-[10px] rounded-full bg-violet" />
              </span>
              <span className="font-mono text-[12.5px] text-subtle-2">
                {poll ? nextLabel(done, poll.status) : 'Queueing the scan'}
              </span>
            </div>
            <p className="mt-[10px] max-w-[46ch] text-[15.5px] leading-[1.5] text-muted">
              We are requesting the page as {catalog.agents.length} clients, one second apart, then rendering it once in a headless browser.
            </p>
          </div>
        </div>
        <div
          className="h-[6px] bg-hairline"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checks completed"
        >
          <div className="h-full bg-violet transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, percent)}%` }} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Stages stageDone={stageDone} running={running} queued={poll?.status === 'queued' || !poll} />

          <div
            className="on-dark relative mt-6 overflow-hidden rounded-[20px] bg-ink px-5 py-5 text-on-ink sm:px-7"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Scan progress"
          >
            {/* The line a scanner draws down a page. Decorative, and removed
                outright under reduced motion. */}
            <div aria-hidden="true" className="br-scanline pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-lime opacity-50" />
            <div className="relative font-mono text-[12.5px] leading-[1.7]">
              {poll ? (
                <>
                  {poll.progress.map((entry, i) => (
                    <LogLine key={entry.key} entry={entry} index={i} />
                  ))}
                  {!poll.settled ? <RunningLine label={nextLabel(poll.progress.length, poll.status)} /> : null}
                </>
              ) : (
                <RunningLine label="Queueing the scan" />
              )}
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-4 font-mono text-[12.5px] font-medium text-coral-text">
              {error}
            </p>
          ) : (
            <p className="mt-4 font-mono text-[12.5px] text-subtle-2">We identify ourselves as BotreadyBot/1.0 and obey your robots.txt.</p>
          )}
        </div>

        <div className="grid content-start gap-[18px]">
          <LiveClients clients={poll?.clients ?? null} />
          <BotScene variant="scanning" shadow="shadow-hard-4" className="hidden lg:block" />
        </div>
      </div>

      <noscript>
        <p className="mt-6 font-mono text-[12.5px] text-subtle-2">
          This page updates with JavaScript. The scan is running either way —{' '}
          <a href={`/scan/${scanId}`} className="underline">
            open the result page
          </a>{' '}
          and reload it in half a minute.
        </p>
      </noscript>
    </Container>
  );
}

const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The count, in a ring that fills as checks land. The number is the checks
 * finished rather than a score: there is no score until the scan settles, and
 * showing a number that climbs towards one would be an invented result.
 */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const fraction = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="42" cy="42" r={RING_RADIUS} fill="none" stroke="var(--color-hairline)" strokeWidth="7" />
          <circle
            cx="42"
            cy="42"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-violet)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="display-tight text-[27px] leading-none tabular-nums tracking-[-0.03em]">{done}</span>
        </div>
      </div>
      <div className="font-mono text-[12.5px] leading-[1.6] text-subtle-2">
        <div className="text-ink">of {total} checks</div>
        <div>no score yet</div>
      </div>
    </div>
  );
}

/**
 * The five requests a scan makes, in the order it makes them. A stage turns
 * green when a check that could only have run after it appears in the progress
 * list, so this is read off the scan rather than counted out on a timer.
 */
function Stages({ stageDone, running, queued }: { stageDone: boolean[]; running: number; queued: boolean }) {
  return (
    <ol className="m-0 grid list-none gap-[10px] p-0">
      {STAGES.map((stage, i) => {
        const complete = stageDone[i] === true;
        const active = !queued && !complete && i === running;
        return (
          <li
            key={stage.label}
            className={cx(
              'edge flex items-start gap-[14px] rounded-[14px] px-[18px] py-[13px] transition-colors duration-300',
              complete ? 'bg-lime-tint' : active ? 'bg-white shadow-hard-3' : 'bg-surface-alt',
            )}
          >
            <span className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
              {complete ? (
                <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]">
                  <circle cx="9" cy="9" r="8" fill="var(--color-lime)" stroke="var(--color-ink)" strokeWidth="2" />
                  <path d="M5.5 9.2l2.4 2.3 4.4-4.8" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : active ? (
                <span className="relative inline-flex h-[10px] w-[10px]">
                  <span className="br-halo absolute inset-0 rounded-full bg-violet" />
                  <span className="anim-pulse-dot relative inline-block h-[10px] w-[10px] rounded-full bg-violet" />
                </span>
              ) : (
                <span className="flex gap-[3px]">
                  <i className="br-march-1 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                  <i className="br-march-2 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                  <i className="br-march-3 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className={cx('block font-mono text-[12.5px] font-medium', complete || active ? 'text-ink' : 'text-subtle-2')}>
                {stage.label}
              </span>
              <span className="mt-[3px] block text-[13.5px] leading-[1.45] text-muted">{stage.detail}</span>
            </span>
            <span className="ml-auto shrink-0 self-center font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-placeholder">
              {complete ? 'done' : active ? 'now' : 'next'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The five clients, resolving.
 *
 * This is the same panel the result page ends with, put on the loading screen
 * so the reader watches the one comparison the product exists to make instead
 * of watching a progress bar. Every row sits on "waiting" until the parity
 * check lands, and then the whole grid snaps to the real status codes at once,
 * because that is when we actually learned them: the five requests are a
 * second apart, but they are recorded as one observation.
 *
 * Nothing here counts down or fills in on a timer. A row that guessed 200 and
 * later corrected itself to 403 would be the loading screen inventing the
 * finding it is supposed to be reporting.
 */
function LiveClients({ clients }: { clients: Poll['clients'] }) {
  const landed = clients !== null;
  const refused = landed
    ? catalog.agents.filter((agent) => {
        const fact = clients.perAgent[agent.id];
        return fact ? fact.status >= 400 || fact.status === 0 || Boolean(fact.transport_error) : false;
      })
    : [];

  return (
    <section className="edge overflow-hidden rounded-[16px] bg-white shadow-hard-4" aria-label="What each client got">
      <div className="border-b border-hairline px-5 py-4 font-mono text-[11.5px] font-medium uppercase tracking-[0.1em] text-subtle-2">
        What each client got
      </div>
      <ul className="m-0 list-none p-0">
        {catalog.agents.map((agent) => {
          const fact = landed ? clients.perAgent[agent.id] : undefined;
          const ok = fact ? fact.status >= 200 && fact.status < 300 && !fact.transport_error : false;
          return (
            <li key={agent.id} className="flex items-center gap-3 border-b border-hairline-2 px-5 py-[14px]">
              <span className={cx('min-w-0 flex-1 font-mono text-[13px] font-medium', fact ? 'text-ink' : 'text-placeholder')}>
                {CLIENT_IDS[agent.id] ?? agent.id}
              </span>
              {fact ? (
                <>
                  <span className="anim-rise-fast font-mono text-[12px] text-placeholder">
                    {fact.transport_error ? 'no response' : `${formatInt(fact.bytes)} B`}
                  </span>
                  <span className="anim-rise-fast">
                    <SoftChip tone={ok ? 'ok' : 'bad'}>{fact.transport_error ? 'ERR' : fact.status}</SoftChip>
                  </span>
                </>
              ) : (
                <span className="flex gap-[3px]" aria-hidden="true">
                  <i className="br-march-1 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                  <i className="br-march-2 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                  <i className="br-march-3 block h-[4px] w-[4px] rounded-full bg-placeholder" />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-5 py-4 text-[13.5px] leading-[1.5]" aria-live="polite">
        {!landed ? (
          <span className="text-subtle-2">Same URL, same second. The Chrome request is the control.</span>
        ) : refused.length > 0 ? (
          <span className="font-medium text-coral-text">
            {refused.map((a) => CLIENT_IDS[a.id] ?? a.id).join(', ')} {refused.length === 1 ? 'was' : 'were'} refused the page Chrome was
            given.
          </span>
        ) : (
          <span className="text-subtle-2">All {catalog.agents.length} clients were served. The rest of the scan is about what they could read.</span>
        )}
      </p>
    </section>
  );
}

const STATUS_COLOUR: Record<CheckStatus, string> = {
  pass: 'text-lime',
  warn: 'text-amber',
  fail: 'text-coral-dark',
  error: 'text-[#B48CD6]',
  skip: 'text-on-ink-muted',
};

const STATUS_WORD: Record<CheckStatus, string> = {
  pass: 'pass',
  warn: 'warn',
  fail: 'FAIL',
  error: 'error',
  skip: 'n/a',
};

function LogLine({ entry, index }: { entry: { key: string; status: CheckStatus }; index: number }) {
  const def = checkDef(entry.key);
  return (
    <div className="anim-rise-fast flex items-baseline gap-4 py-[3px]">
      <span className="w-[32px] shrink-0 tabular-nums text-on-ink-muted">{String(index + 1).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1">{def?.label ?? entry.key}</span>
      <span className={cx('shrink-0 font-bold', STATUS_COLOUR[entry.status])}>{STATUS_WORD[entry.status]}</span>
    </div>
  );
}

function RunningLine({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-4 py-[3px] text-on-ink-muted">
      <span className="flex w-[32px] shrink-0 items-center" aria-hidden="true">
        <i className="anim-pulse-dot block h-[7px] w-[7px] rounded-[1px] bg-lime" />
      </span>
      <span className="min-w-0 flex-1">
        {label}
        <i className="br-caret ml-[3px] inline-block h-[12px] w-[7px] translate-y-[1px] bg-lime align-baseline" aria-hidden="true" />
      </span>
      <span className="shrink-0 font-bold">running</span>
    </div>
  );
}

function nextLabel(done: number, status: Poll['status']): string {
  if (status === 'queued') return 'Waiting for a worker to pick this up';
  if (done === 0) return 'GET /robots.txt';
  if (done <= 2) return 'GET / as BotreadyBot/1.0';
  if (done <= 5) return 'GET /sitemap.xml, /llms.txt, /.well-known/…';
  if (done <= 9) return 'GET / as Chrome, ClaudeBot, GPTBot, PerplexityBot, Google-Extended';
  if (done <= 11) return 'Rendering with a headless browser';
  return 'Comparing raw text against rendered text';
}
