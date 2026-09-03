'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { LIMITS } from '@/lib/site';

/**
 * The one input on the landing page. The button says what happens and the
 * error, if there is one, says what went wrong and what to do about it. No
 * apology, because we did not do anything wrong and neither did the reader.
 */
export function ScanForm({
  autoFocus = false,
  stacked = false,
}: {
  autoFocus?: boolean;
  stacked?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const busy = pending || submitting;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      const body = (await res.json()) as { scanId?: string; error?: string; retryAfter?: number };

      if (!res.ok || !body.scanId) {
        setError(body.error ?? `The scan could not be started (HTTP ${res.status}).`);
        setSubmitting(false);
        return;
      }

      startTransition(() => {
        router.push(`/scan/${body.scanId}`);
      });
    } catch {
      setError('The request did not reach us. Check your connection and run the check again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div
        className={`mt-7 flex max-w-[620px] overflow-hidden rounded-[5px] border-[1.5px] border-ink bg-card ${
          stacked ? 'flex-col' : 'flex-row'
        }`}
      >
        <div className="flex flex-1 items-center">
          <span
            aria-hidden="true"
            className="pl-4 font-data text-[14px] text-ink-60 select-none"
          >
            https://
          </span>
          <input
            name="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="yoursite.com"
            aria-label="Site to check"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'scan-error' : 'scan-limits'}
            className="w-full flex-1 border-0 bg-transparent px-2.5 py-[15px] font-data text-[14px] text-ink outline-none placeholder:text-ink-60"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className={`cursor-pointer border-0 bg-ink px-6 py-3.5 font-body font-semibold text-paper disabled:cursor-progress disabled:opacity-70 ${
            stacked ? 'w-full border-t-[1.5px] border-ink' : 'border-l-[1.5px] border-ink'
          }`}
        >
          {busy ? 'Starting the check' : 'Run the check'}
        </button>
      </div>

      {error ? (
        <p
          id="scan-error"
          role="alert"
          className="mt-2.5 max-w-[620px] font-data text-[12.5px] font-medium text-fail"
        >
          {error}
        </p>
      ) : (
        <p id="scan-limits" className="mt-2.5 font-data text-[12.5px] text-ink-60">
          Free · no account · takes about 30 seconds · {LIMITS.maxPagesPerScan} pages max
        </p>
      )}
    </form>
  );
}
