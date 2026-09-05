'use client';

import { useState } from 'react';

import { cx } from '@/components/ui';

/**
 * The coding-agent prompt, on the confirmation screen, in the browser.
 *
 * A buyer who has just paid should not have to open an email, find an
 * attachment and open that to see the thing they bought. The prompt is the
 * piece they act on, so it is on the page, whole, with one button that puts it
 * on the clipboard — which is the only thing anyone actually does with it.
 */
export function PromptPanel({ prompt, filename }: { prompt: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      // Long enough to read, short enough that the button is ready again by
      // the time anyone wants it.
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // A clipboard a browser will not give us is not an error worth a toast:
      // the text is on the page and selectable.
      setCopied(false);
    }
  }

  const lines = prompt.split('\n').length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-[22px]">The prompt</h2>
          <p className="mt-1 max-w-[54ch] text-[15px] leading-[1.55] text-muted">
            Paste it into Claude Code or Cursor, in the repository that serves the site. It applies the rest one commit at a
            time and stops after each for review.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cx(
            'edge inline-flex cursor-pointer items-center gap-2 rounded-[12px] px-[18px] py-[12px] font-body text-[14.5px] font-bold transition-colors duration-150',
            copied ? 'bg-lime text-ink' : 'bg-violet text-white hover:bg-ink',
          )}
        >
          {copied ? 'Copied' : 'Copy the prompt'}
        </button>
      </div>

      <div className="edge mt-4 overflow-hidden rounded-[18px] bg-ink shadow-violet-5">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-[11px] font-mono text-[12px] text-on-ink-muted">
          <span>{filename}</span>
          <span>
            {lines} lines · {Math.ceil(prompt.length / 1024)} KB
          </span>
        </div>
        {/* Scrolls in its own box rather than growing the page to twelve
            thousand characters, and is reachable from a keyboard because it
            scrolls. */}
        <pre
          tabIndex={0}
          role="group"
          aria-label="The coding agent prompt"
          className="m-0 max-h-[420px] overflow-auto px-5 py-4 font-mono text-[12.5px] leading-[1.65] text-on-ink"
        >
          {prompt}
        </pre>
      </div>
    </section>
  );
}
