'use client';

import { useState } from 'react';

import type { FixFile } from '@botready/core';

import { cx } from '@/components/ui';

/**
 * The generated files, shown rather than described.
 *
 * The result page has always called buildFixPack and then displayed the
 * filenames on chips — computing the entire paid artifact and hiding it. That
 * is why the price reads as vague: everything on the page argues that the
 * problem is real and nothing shows that the answer is already written.
 *
 * So the first lines are open. Not a sample of somebody else's site: this is
 * the reader's own domain, their own URLs, pulled out of their own sitemap.
 * The argument for the price is that it is already done, and the only way to
 * make that argument is to let them look at it.
 *
 * This is not the diagnosis behind a wall — the diagnosis is above, entire and
 * free. It is a window onto the thing being sold.
 */

/** Enough to see it is real and specific. Short enough to still be a preview. */
const OPEN_LINES = 12;

export function FixPackPreview({ files, domain }: { files: FixFile[]; domain: string }) {
  const usable = files.filter((f) => f.content.trim().length > 0);
  const [active, setActive] = useState(0);
  if (usable.length === 0) return null;

  const file = usable[Math.min(active, usable.length - 1)]!;
  const lines = file.content.split('\n');
  const shown = lines.slice(0, OPEN_LINES);
  const hidden = Math.max(0, lines.length - OPEN_LINES);

  return (
    <div className="edge overflow-hidden rounded-[18px] bg-ink shadow-lime-4">
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-[10px]" role="tablist" aria-label="Generated files">
        {usable.map((f, i) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cx(
              'cursor-pointer whitespace-nowrap rounded-[9px] border-0 px-[13px] py-[7px] font-mono text-[12.5px] font-medium transition-colors',
              i === active ? 'bg-lime text-ink' : 'bg-transparent text-on-ink-muted hover:text-on-ink',
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      <p className="border-b border-white/10 px-5 py-[11px] font-mono text-[12px] leading-[1.5] text-on-ink-muted">{file.purpose}</p>

      <div className="relative">
        <pre className="m-0 overflow-x-auto px-5 pb-8 pt-4 font-mono text-[12.5px] leading-[1.7] text-on-ink">
          {shown.join('\n')}
        </pre>
        {/* A fade, not a blur over words. The lines above are readable and real;
            this only marks where the preview stops. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-[13px] font-mono text-[12px] text-on-ink-muted">
        <span>
          {hidden > 0 ? `${hidden} more ${hidden === 1 ? 'line' : 'lines'}` : 'complete'} · written for {domain}
        </span>
        {/* Deliberately not a file count: the ledger above is the count, and
            two different numbers on one panel is how a page loses an argument. */}
        <span className="text-lime">preview</span>
      </div>
    </div>
  );
}
