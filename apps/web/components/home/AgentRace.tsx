'use client';

import { useEffect, useState } from 'react';

import { MARQUEE, RACE } from '@/lib/copy';
import { DashConnector, cx } from '@/components/ui';

const STEP_MS = 620;

/**
 * Five agent rows arrive one at a time on a 620ms interval, looping 0→7 so
 * the set rests fully arrived before it restarts. Unarrived rows sit shifted
 * left at half opacity with a `···` status. Below, a marquee of twelve real
 * crawler user agents.
 */
export function AgentRace() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStep(7);
      return;
    }
    const t = setInterval(() => setStep((s) => (s + 1 > 7 ? 0 : s + 1)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="edge on-dark overflow-hidden rounded-[20px] bg-violet p-[30px] shadow-hard-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-[11.5px] font-medium tracking-[0.14em] text-lime">ONE REQUEST, FIVE AGENTS — EXAMPLE</span>
        <span className="font-mono text-[12px] text-on-violet-2" aria-live="polite">
          {step >= 5 ? '3 of 5 got nothing readable' : 'same URL · same second'}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="edge flex-none rounded-[12px] bg-lime px-[13px] py-[14px] text-center font-mono text-[13px] font-bold leading-[1.5] text-ink shadow-hard-3">
          GET /<br />×5
        </div>
        <DashConnector />
        <ul className="m-0 grid min-w-0 flex-1 list-none grid-cols-[minmax(0,1fr)] gap-[9px] p-0">
          {RACE.map((r, i) => {
            const arrived = step > i;
            return (
              <li
                key={r.name}
                className={cx(
                  'edge flex items-center gap-3 rounded-[11px] bg-white px-[13px] py-[9px] text-ink transition-[transform,opacity] duration-300 ease-out',
                  arrived ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-50',
                )}
              >
                <span
                  className={cx(
                    'edge min-w-[52px] rounded-[7px] px-[9px] py-[2px] text-center font-mono text-[12px] font-bold',
                    !arrived ? 'bg-canvas text-subtle-2' : r.ok ? 'bg-lime text-ink' : 'bg-coral text-ink',
                  )}
                >
                  {arrived ? r.status : '···'}
                </span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[13.5px] font-medium">{r.name}</span>
                <span
                  className={cx(
                    'overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px]',
                    !arrived ? 'text-placeholder' : r.ok ? 'text-muted' : 'text-coral-text',
                  )}
                >
                  {arrived ? r.note : 'waiting'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-[22px] overflow-hidden border-t-2 border-violet-rule pt-[18px]" aria-hidden="true">
        <div className="anim-marquee flex w-max gap-9 font-mono text-[12.5px] text-on-violet-2">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={`${m}-${i}`} className="whitespace-nowrap">
              {m}
            </span>
          ))}
        </div>
      </div>
      <p className="sr-only">Crawler user agents we see in the wild: {MARQUEE.join(', ')}.</p>
    </div>
  );
}
