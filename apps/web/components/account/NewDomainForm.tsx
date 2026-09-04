'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { normaliseDomain } from '@botready/core';

import { LIMITS } from '@/lib/site';

/**
 * One field, one button that says what happens. The check starts, the live
 * page shows it running, and when it settles the claim page is next.
 */
export function NewDomainForm({ initialDomain = '' }: { initialDomain?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialDomain);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter a domain to check.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const body = (await res.json()) as { scanId?: string; domain?: string; error?: string };
      if (!res.ok || !body.scanId) {
        setError(body.error ?? `The check could not be started (HTTP ${res.status}). Try again in a minute.`);
        setBusy(false);
        return;
      }
      const domain = body.domain ?? normaliseDomain(trimmed);
      router.push(`/scan/live?id=${encodeURIComponent(body.scanId)}&next=${encodeURIComponent(`/claim/${domain}`)}`);
    } catch {
      setError('The request did not reach us. Check your connection and run the check again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-[560px]">
      <label htmlFor="domain" className="mb-[7px] block font-body text-[13px] font-medium text-body">
        Domain
      </label>
      <div className="edge flex items-center gap-2 rounded-[12px] bg-white py-[5px] pl-[14px] pr-[5px]">
        <span aria-hidden="true" className="font-mono text-[15px] text-placeholder">
          https://
        </span>
        <input
          id="domain"
          name="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="yoursite.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'domain-error' : 'domain-note'}
          className="min-w-0 flex-1 border-0 bg-transparent py-[11px] font-mono text-[15px] text-ink outline-none placeholder:text-placeholder"
        />
        <button
          type="submit"
          disabled={busy}
          className="on-lime edge cursor-pointer whitespace-nowrap rounded-[9px] bg-lime px-4 py-[10px] font-body text-[14px] font-bold text-ink transition-colors duration-150 hover:bg-white disabled:cursor-progress disabled:opacity-70"
        >
          {busy ? 'Starting the check' : 'Run the check'}
        </button>
      </div>
      {error ? (
        <p id="domain-error" role="alert" className="mt-[14px] font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : (
        <p id="domain-note" className="mt-[14px] font-mono text-[12.5px] text-subtle">
          Up to {LIMITS.maxPagesPerScan} pages, one at a time, a second apart. About 30 seconds.
        </p>
      )}
    </form>
  );
}
