'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, Eyebrow } from '@/components/ui';
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
      <p className="max-w-[64ch] text-[15px] leading-[1.6] text-muted">
        Publish this token at either of the two places below. Anyone can type a domain name; only the person who
        controls it can put a value we chose where we said.
      </p>

      <Card as="section" shadow={3} className="mt-5 px-[22px] py-5">
        <Eyebrow as="p" tone="subtle">
          Option 1 · DNS TXT record
        </Eyebrow>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 font-mono text-[13px]">
          <dt className="text-subtle-2">host</dt>
          <dd className="m-0 break-all text-ink">{instructions.dns.host}</dd>
          <dt className="text-subtle-2">type</dt>
          <dd className="m-0 text-ink">TXT</dd>
          <dt className="text-subtle-2">value</dt>
          <dd className="m-0 break-all text-ink">{instructions.dns.value}</dd>
        </dl>
      </Card>

      <Card as="section" shadow={3} className="mt-4 px-[22px] py-5">
        <Eyebrow as="p" tone="subtle">
          Option 2 · meta tag on the homepage
        </Eyebrow>
        <pre
          tabIndex={0}
          role="group"
          aria-label="The meta tag to add"
          className="edge mt-3 overflow-x-auto rounded-[10px] bg-surface-alt px-[14px] py-[12px] font-mono text-[13px] leading-[1.5] whitespace-pre-wrap text-ink"
        >
          {instructions.meta.tag}
        </pre>
      </Card>

      <Button type="button" tone="lime" shadow={3} onClick={check} disabled={state === 'checking'} className="mt-6">
        {state === 'checking' ? 'Checking for the token' : 'Check for the token'}
      </Button>

      {error ? (
        <p role="alert" className="mt-4 max-w-[64ch] text-[14.5px] leading-[1.5] text-coral-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
