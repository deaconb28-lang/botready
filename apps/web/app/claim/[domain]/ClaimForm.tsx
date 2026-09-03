'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ClaimInstructions } from '@/lib/claims';

/**
 * Two ways to prove control, both shown, and one button that checks for either.
 * The token is the same in both places, and it is different for every person
 * and domain, so it can be shown in full.
 */
export function ClaimForm({ domain, instructions }: { domain: string; instructions: ClaimInstructions }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'checking'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (state === 'checking') return;
    setError(null);
    setState('checking');
    try {
      const res = await fetch('/api/claim', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const body = (await res.json()) as { verified?: boolean; reason?: string; error?: string };
      if (!res.ok || !body.verified) {
        setError(body.reason ?? body.error ?? `The check failed (HTTP ${res.status}).`);
        setState('idle');
        return;
      }
      router.refresh();
    } catch {
      setError('The request did not reach us. Check your connection and check again.');
      setState('idle');
    }
  }

  return (
    <div className="mt-6">
      <p className="max-w-[64ch] text-[14px] text-ink-60">
        Publish this token at either of the two places below. Anyone can type a domain name;
        only the person who controls it can put a value we chose where we said.
      </p>

      <section className="mt-5 rounded-[6px] border border-rule bg-card px-[22px] py-5">
        <h2 className="font-data text-[11px] font-bold uppercase tracking-[0.1em] text-ink-60">
          Option 1 · DNS TXT record
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-data text-[12.5px]">
          <dt className="text-ink-60">host</dt>
          <dd className="break-all">{instructions.dns.host}</dd>
          <dt className="text-ink-60">type</dt>
          <dd>TXT</dd>
          <dt className="text-ink-60">value</dt>
          <dd className="break-all">{instructions.dns.value}</dd>
        </dl>
      </section>

      <section className="mt-3 rounded-[6px] border border-rule bg-card px-[22px] py-5">
        <h2 className="font-data text-[11px] font-bold uppercase tracking-[0.1em] text-ink-60">
          Option 2 · meta tag on the homepage
        </h2>
        <pre
          tabIndex={0}
          role="group"
          aria-label="The meta tag to add"
          className="mt-3 overflow-x-auto rounded-[4px] border border-dashed border-rule bg-paper px-[13px] py-[11px] font-data text-[12px] whitespace-pre-wrap text-ink"
        >
          {instructions.meta.tag}
        </pre>
      </section>

      <button
        type="button"
        onClick={check}
        disabled={state === 'checking'}
        className="mt-5 cursor-pointer rounded-[4px] border border-ink bg-ink px-[18px] py-2.5 font-body text-[14px] font-semibold text-paper disabled:cursor-progress disabled:opacity-70"
      >
        {state === 'checking' ? 'Checking for the token' : 'Check for the token'}
      </button>

      {error ? (
        <p role="alert" className="mt-3 max-w-[64ch] font-data text-[12.5px] font-medium text-fail">
          {error}
        </p>
      ) : null}
    </div>
  );
}
