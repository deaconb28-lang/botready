'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { catalog, checkDef, type CheckStatus } from '@botready/core';

import { Container, cx } from '@/components/ui';

/**
 * The wait is the demo.
 *
 * Every line in the log is a check the worker actually finished, read off the
 * same polling endpoint the result page uses. Nothing is simulated on a
 * timer: a line appears when the evidence row exists. When the scan settles
 * the page moves to the result, where the score counts up.
 */

interface Poll {
  status: 'queued' | 'running' | 'complete' | 'blocked' | 'error';
  settled: boolean;
  domain: string;
  url: string;
  pagesCrawled: number;
  errorMessage: string | null;
  progress: Array<{ key: string; status: CheckStatus }>;
  score: { total: number; grade: string } | null;
}

const POLL_MS = 1200;
const GIVE_UP_MS = 180_000;

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

  return (
    <Container width={1120} className="pb-24 pt-11">
      <div className="font-mono text-[12.5px] text-subtle-2">
        <span className="text-ink">{poll?.domain ?? 'your site'}</span> · reading as {catalog.agents.length} clients… · {elapsed}s
      </div>

      <div className="edge mt-[18px] overflow-hidden rounded-[24px] bg-white">
        <div className="flex flex-wrap items-center gap-8 border-b border-hairline px-6 py-[30px] sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="display-tight text-[64px] leading-none tracking-[-0.04em] text-placeholder">··</span>
            <span className="font-mono text-[14px] text-subtle-2">/ 100</span>
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-[10px]">
              <span aria-hidden="true" className="anim-pulse-dot inline-block h-[10px] w-[10px] rounded-full bg-violet" />
              <span className="font-mono text-[12.5px] text-subtle-2">{poll ? nextLabel(done, poll.status) : 'Queueing the scan'}</span>
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

      <div className="on-dark mt-6 rounded-[20px] bg-ink px-5 py-5 text-on-ink sm:px-7" role="log" aria-live="polite" aria-relevant="additions" aria-label="Scan progress">
        <div className="font-mono text-[12.5px] leading-[1.7]">
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
      <span className="w-[32px] shrink-0 text-on-ink-muted">{String(index + 1).padStart(2, '0')}</span>
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
      <span className="min-w-0 flex-1">{label}</span>
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
