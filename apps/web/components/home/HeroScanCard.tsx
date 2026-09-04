'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cx } from '@/components/ui';

const TABS = [
  { id: 'url', label: 'URL', placeholder: 'yoursite.com' },
  { id: 'sitemap', label: 'Sitemap', placeholder: 'yoursite.com/sitemap.xml' },
  { id: 'domain', label: 'Domain', placeholder: 'yoursite.com' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * The scan card. Three tabs change the placeholder; the button says what
 * happens and the error, if there is one, says what went wrong and what to do
 * next.
 *
 * There is no `https://` printed beside the field. It was decoration: the
 * scheme is added for you when you leave it off, and printing it made the field
 * read as `https://https://yoursite.com` for anyone pasting a full URL, which
 * is what most people do.
 */
export function HeroScanCard({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('url');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter a site to check.');
      return;
    }
    setBusy(true);
    // A sitemap URL scans the site it belongs to; a domain scans its root.
    // Either way the scheme is filled in here rather than asked for.
    const url = tab === 'sitemap' ? originOf(trimmed) : withScheme(trimmed.replace(/^@/, ''));
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { scanId?: string; error?: string };
      if (!res.ok || !body.scanId) {
        setError(body.error ?? `The scan could not be started (HTTP ${res.status}). Try again in a minute.`);
        setBusy(false);
        return;
      }
      router.push(`/scan/${body.scanId}`);
    } catch {
      setError('The request did not reach us. Check your connection and run the check again.');
      setBusy(false);
    }
  }

  return (
    <form
      id="check"
      onSubmit={submit}
      noValidate
      className={cx('edge mx-auto rounded-[16px] bg-white p-2 text-left shadow-hard-5', compact ? 'max-w-[580px]' : 'max-w-[640px]', className)}
    >
      <div className="flex gap-1 px-1 pb-[10px] pt-1" role="tablist" aria-label="What to check">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'cursor-pointer rounded-[9px] border-0 px-[13px] py-[7px] font-body text-[13px] font-medium',
              tab === t.id ? 'bg-chip-bg text-ink' : 'bg-transparent text-subtle-2 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center rounded-[14px] border border-hairline-3 bg-surface-alt py-[6px] pl-4 pr-[6px]">
        {/* The caret sits after the placeholder rather than before it, so the
            field reads as a prompt waiting to be typed into instead of as a bar
            parked in the interface. The real caret takes over the moment you
            focus, which is what `peer-focus` is doing — two carets in one field
            was the flaw in every earlier version of this.

            The native placeholder stays, transparent: it keeps the input's own
            semantics and autofill behaviour, and the span below is what is
            actually read. */}
        <div className="relative min-w-0 flex-1">
          <input
            id="scan-url"
            name="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={active.placeholder}
            aria-label="Site to check"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'scan-error' : 'scan-limits'}
            className="peer w-full border-0 bg-transparent py-3 pr-2 font-mono text-[15.5px] text-ink outline-none placeholder:text-transparent"
          />
          {!value ? (
            <span
              aria-hidden="true"
              // The variant hangs off the span, not the caret: `peer-focus`
              // compiles to a sibling selector and the caret is a grandchild of
              // the input. Reaching into it keeps the placeholder visible on
              // focus and takes only the caret away.
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center font-mono text-[15.5px] text-placeholder peer-focus:[&>i]:opacity-0"
            >
              {active.placeholder}
              <i className="anim-cursor ml-[3px] block h-[17px] w-[8px] rounded-[1px] bg-violet" />
            </span>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="edge cursor-pointer whitespace-nowrap rounded-[10px] bg-ink px-5 py-3 font-body text-[14.5px] font-bold text-white shadow-hard-2 transition-colors hover:bg-violet disabled:cursor-progress disabled:opacity-70"
        >
          {busy ? 'Starting the check' : 'Run the check'}
        </button>
      </div>
      <div className="flex flex-wrap justify-between gap-3 px-2 pb-[6px] pt-3 font-mono text-[12.5px] text-subtle-2">
        {error ? (
          <span id="scan-error" role="alert" className="font-medium text-coral-text">
            {error}
          </span>
        ) : (
          <span id="scan-limits" className="whitespace-nowrap">
            free · no account · ~30 seconds
          </span>
        )}
        <Link href="/preview/waf-blocked-spa" className="whitespace-nowrap font-mono text-[12.5px] text-violet underline underline-offset-[3px]">
          see an example result
        </Link>
      </div>
    </form>
  );
}

/** `yoursite.com` -> `https://yoursite.com`, and a full URL is left alone. */
function withScheme(input: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
}

function originOf(input: string): string {
  try {
    return new URL(withScheme(input)).origin;
  } catch {
    return input;
  }
}
