'use client';

import { useEffect, useRef, useState } from 'react';

import { COPY } from '@/lib/copy';
import { cx } from '@/components/ui';

const CHAR_MS = 16;

/**
 * A realistic assistant transcript. The answer types in at 16ms a character,
 * restarts when the register changes, and flips between the broken answer
 * and the fixed one. The assistant bubble holds a fixed width and a minimum
 * height so the card does not reflow while the text arrives.
 *
 * This is an example, and the card says so: the names in it are made up.
 */
export function ChatProof() {
  const copy = COPY;
  const [fixed, setFixed] = useState(false);
  const [typed, setTyped] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const text = fixed ? copy.fixed : copy.invisible;

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(text);
      return;
    }
    let i = 0;
    setTyped('');
    timer.current = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length && timer.current) clearInterval(timer.current);
    }, CHAR_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [text]);

  return (
    <div className="edge overflow-hidden rounded-[18px] bg-white shadow-hard-4">
      <div className="flex items-center gap-[10px] border-b border-hairline px-[18px] py-[14px]">
        <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ink font-body text-[12px] font-semibold text-white">
          AI
        </span>
        <span className="font-body text-[14px] font-semibold">Assistant</span>
        <span className="ml-auto font-mono text-[11.5px] text-placeholder">example</span>
      </div>
      <div className="grid gap-[14px] px-[18px] py-5">
        <div className="anim-pop max-w-[82%] justify-self-end rounded-[16px_16px_4px_16px] bg-[#EEF1F6] px-[15px] py-3 text-[15px] leading-[1.45]">
          {copy.question}
        </div>
        <div
          className="w-[88%] min-h-[96px] justify-self-start rounded-[16px_16px_16px_4px] border border-[#EDEDE7] bg-surface-alt px-4 py-[13px] text-[15px] leading-[1.55]"
          aria-live="polite"
        >
          {typed}
          <span aria-hidden="true" className="anim-caret ml-px inline-block h-[15px] w-[7px] bg-violet align-[-2px]" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-paper px-[18px] py-[14px]">
        <span
          className={cx(
            'rounded-[8px] px-[11px] py-[6px] font-mono text-[12.5px] font-medium',
            fixed ? 'bg-green-tint text-green-text' : 'bg-coral-tint text-coral-text',
          )}
        >
          {fixed ? copy.verdictGood : copy.verdictBad}
        </span>
        <button
          type="button"
          onClick={() => setFixed((v) => !v)}
          className={cx(
            'cursor-pointer rounded-[9px] px-[14px] py-[9px] font-body text-[13.5px]',
            fixed ? 'edge bg-white font-medium text-muted hover:text-ink' : 'border-0 bg-ink font-semibold text-white hover:bg-violet',
          )}
        >
          {fixed ? copy.flipToBroken : copy.flipToFixed}
        </button>
      </div>
    </div>
  );
}
