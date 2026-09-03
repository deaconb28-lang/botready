'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { catalog, checkDef, type CheckStatus } from '@botready/core';

import { Measure } from '@/components/primitives';

/**
 * The wait is the demo.
 *
 * Watching real requests come back with real status codes is more persuasive
 * than a spinner, and the 403 lines land before the score does. Everything in
 * the log is a check the worker actually finished, read off the same polling
 * endpoint the result page uses. Nothing is faked and nothing is simulated on a
 * timer: a line appears when the evidence row exists.
 *
 * The log is an ink panel — the same material as the grade band it turns into.
 */

interface Poll {
  status: 'queued' | 'running' | 'complete' | 'blocked' | 'error';
  settled: boolean;
  domain: string;
  pagesCrawled: number;
  errorMessage: string | null;
  startedAt: string | null;
  progress: Array<{ key: string; status: CheckStatus }>;
  score: { total: number; grade: string } | null;
}

const POLL_MS = 1200;
/** A scan that has not settled in three minutes is not going to. */
const GIVE_UP_MS = 180_000;

export function LiveScan({ scanId }: { scanId: string }) {
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
          setTimeout(() => router.replace(`/scan/${scanId}`), 700);
          return;
        }
        if (Date.now() - startedAt.current > GIVE_UP_MS) {
          settled.current = true;
          setError(
            'The scan has been running for three minutes, which is longer than any scan should take. It may still finish; the result page will show it when it does.',
          );
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
  }, [scanId, router]);

  const done = poll?.progress.length ?? 0;
  const total = catalog.checks.length;
  const percent = Math.min(96, Math.round((done / total) * 100));

  return (
    <Measure className="pb-16 pt-8">
      <p className="label text-ink-60">Running the check</p>
      <h1 className="display-section mt-2 text-[26px] sm:text-[32px]">Reading {poll?.domain ?? 'your site'} the way agents do</h1>
      <p className="mono mt-2 text-[13px] text-ink-60">
        6 pages · {catalog.agents.length} clients · started {elapsed} {elapsed === 1 ? 'second' : 'seconds'} ago
      </p>

      <div
        className="on-ink mt-7 rounded-[6px] bg-ink px-5 py-5 text-paper sm:px-7"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Scan progress"
      >
        <div className="wire-line">
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

        <div
          className="mt-5 h-[5px] overflow-hidden rounded-[3px] bg-ink-seg"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checks completed"
        >
          <i
            className="block h-full bg-paper transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mono mt-4 text-[12.5px] font-medium text-fail">
          {error}
        </p>
      ) : (
        <p className="mono mt-4 text-[12.5px] text-ink-60">
          We identify ourselves as BotreadyBot/1.0 and obey your robots.txt.
        </p>
      )}

      <noscript>
        <p className="mono mt-6 text-[12.5px] text-ink-60">
          This page updates with JavaScript. The scan is running either way —{' '}
          <a href={`/scan/${scanId}`} className="underline">
            open the result page
          </a>{' '}
          and reload it in half a minute.
        </p>
      </noscript>
    </Measure>
  );
}

const STATUS_COLOUR: Record<CheckStatus, string> = {
  pass: 'text-paper',
  warn: 'text-[#D69A5C]',
  fail: 'text-fail-dark',
  error: 'text-[#B48CD6]',
  skip: 'text-ink-key',
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
    <div className="br-slide-in flex items-baseline gap-4 py-[3px]">
      <span className="w-[32px] shrink-0 text-ink-key">{String(index + 1).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1">{def?.label ?? entry.key}</span>
      <span className={`shrink-0 font-bold ${STATUS_COLOUR[entry.status]}`}>{STATUS_WORD[entry.status]}</span>
    </div>
  );
}

/** The words hold still; a small square does the moving. */
function RunningLine({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-4 py-[3px] text-ink-key">
      <span className="flex w-[32px] shrink-0 items-center" aria-hidden="true">
        <i className="br-pulse-dot block h-[7px] w-[7px] rounded-[1px] bg-paper" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="shrink-0 font-bold">running</span>
    </div>
  );
}

/**
 * What the worker is doing next, inferred from how far it has got. The order
 * matches the scan's own order, so this is a description of the pipeline
 * rather than a guess.
 */
function nextLabel(done: number, status: Poll['status']): string {
  if (status === 'queued') return 'Waiting for a worker to pick this up';
  if (done === 0) return 'GET /robots.txt';
  if (done <= 2) return 'GET / as BotreadyBot/1.0';
  if (done <= 5) return 'GET /sitemap.xml, /llms.txt, /.well-known/…';
  if (done <= 9) return 'GET / as Chrome, ClaudeBot, GPTBot, PerplexityBot, Google-Extended';
  if (done <= 11) return 'Rendering with a headless browser';
  return 'Comparing raw text against rendered text';
}
