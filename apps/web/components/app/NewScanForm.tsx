'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * One URL field with a lime submit. On a property it scans that domain again
 * or any other page you name; from /app/new it scans a new domain and takes
 * you to the claim flow, which is what turns a scan into a property.
 */
export function NewScanForm({ mode, domain }: { mode: 'claim' | 'property'; domain?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(mode === 'property' && domain ? `${domain}/` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const target = value.trim().replace(/^https?:\/\//i, '');
    if (!target) {
      setError('Enter a URL to check.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: `https://${target}`, force: mode === 'property' }),
      });
      const body = (await res.json()) as { scanId?: string; error?: string };
      if (!res.ok || !body.scanId) {
        setError(body.error ?? `The scan could not be started (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      const host = target.split('/')[0] ?? target;
      const next = mode === 'claim' ? `/claim/${host}` : `/app/${host.replace(/^www\./, '')}`;
      router.push(`/scan/live?id=${body.scanId}&next=${encodeURIComponent(next)}`);
    } catch {
      setError('The request did not reach us. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="edge rounded-[14px] bg-white p-2 shadow-hard-4">
        <div className="edge flex items-center gap-2 rounded-[11px] bg-surface-alt py-[5px] pl-[15px] pr-[5px]">
          <span aria-hidden="true" className="font-mono text-[15px] text-subtle">
            https://
          </span>
          <input
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
            placeholder="yoursite.com"
            aria-label="URL to check"
            aria-invalid={error ? true : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent py-3 font-mono text-[15.5px] text-ink outline-none placeholder:text-subtle"
          />
          <button
            type="submit"
            disabled={busy}
            className="edge cursor-pointer whitespace-nowrap rounded-[9px] bg-lime px-[18px] py-[11px] font-body text-[14.5px] font-bold text-ink shadow-hard-2 hover:bg-violet hover:text-white disabled:cursor-progress"
          >
            {busy ? 'Starting…' : 'Run the check'}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
