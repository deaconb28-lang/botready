'use client';

import { useState } from 'react';

import { cx } from '@/components/ui';

export interface EditorFile {
  name: string;
  purpose: string;
  body: string;
  truncated: boolean;
  incomplete: boolean;
}

/**
 * The file list beside a black code viewer with a violet hard shadow. Copy
 * puts the file on the clipboard; when the pack has not been bought the body
 * is a real preview that stops mid-file, never a blur.
 */
export function EditorView({
  files,
  run,
  owned,
  downloadHref,
  buyHref,
  price,
}: {
  files: EditorFile[];
  run: number;
  owned: boolean;
  downloadHref: string | null;
  buyHref: string;
  price: string;
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[active];

  if (files.length === 0) {
    return <p className="text-[15px] text-body">Nothing generated yet.</p>;
  }

  async function copy() {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
      <div className="edge overflow-hidden rounded-[14px] bg-white shadow-hard-3">
        {files.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              setActive(i);
              setCopied(false);
            }}
            aria-current={i === active ? 'true' : undefined}
            className={cx(
              'block w-full cursor-pointer border-0 border-b-2 border-rule px-4 py-[13px] text-left font-mono text-[13.5px] text-ink last:border-b-0',
              i === active ? 'bg-lime font-bold' : 'bg-white font-medium hover:bg-lime-tint',
            )}
          >
            {f.name}
            {f.incomplete ? <span className="ml-2 font-normal text-quiet">incomplete</span> : null}
          </button>
        ))}
      </div>

      <div>
        <div className="on-dark overflow-hidden rounded-[14px] border-2 border-ink bg-ink shadow-violet-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink-2 px-[18px] py-3">
            <span className="font-mono text-[13px] font-medium text-lime">{file?.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-subtle">generated from run {String(run).padStart(2, '0')}</span>
              <button
                type="button"
                onClick={copy}
                className="edge cursor-pointer rounded-[8px] border-white bg-transparent px-[10px] py-[3px] font-mono text-[12px] font-bold text-white hover:bg-white hover:text-ink"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <pre className="min-h-[300px] overflow-auto whitespace-pre-wrap p-[22px] font-mono text-[12.5px] leading-[1.85] text-on-ink-3">{file?.body}</pre>
          {file?.truncated ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink-2 px-[18px] py-4">
              <span className="font-mono text-[12.5px] text-subtle">This is the real file, stopping part way through. The pack has all of it.</span>
              <a href={buyHref} className="edge whitespace-nowrap rounded-[9px] bg-lime px-4 py-[9px] font-body text-[13.5px] font-bold text-ink no-underline shadow-hard-2 hover:bg-white">
                Get the pack — {price}
              </a>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[60ch] text-[14px] leading-[1.55] text-body">{file?.purpose}</p>
          {owned && downloadHref ? (
            <a href={downloadHref} className="edge whitespace-nowrap rounded-[10px] bg-lime px-[18px] py-[11px] font-body text-[14px] font-bold text-ink no-underline shadow-hard-3 hover:bg-white">
              Download all files
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
