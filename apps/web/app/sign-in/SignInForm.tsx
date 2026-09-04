'use client';

import { useState } from 'react';

/**
 * The magic-link field. One email, one button that says what happens. The
 * sent state and the error state are sentences: what happened, and what to do.
 */
export function SignInForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(
    initialError === 'missing-code' ? 'That link was missing its code. Send a new one below.' : initialError,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setError(null);
    setState('sending');

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `The sign-in email could not be sent (HTTP ${res.status}). Send it again in a minute.`);
        setState('idle');
        return;
      }
      setState('sent');
    } catch {
      setError('The request did not reach us. Check your connection and send the link again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div>
        <p className="mb-[7px] block font-body text-[13px] font-medium text-body">Work email</p>
        <p role="status" className="edge rounded-[12px] bg-green-tint px-[14px] py-[13px] text-[14.5px] leading-[1.5] text-ink">
          The link is on its way to <span className="font-mono">{email}</span>. Open it on this device to continue. It works once and expires in an hour.
        </p>
        <p className="mt-[14px] font-mono text-[12.5px] text-subtle">
          Wrong address?{' '}
          <button
            type="button"
            onClick={() => setState('idle')}
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12.5px] text-violet underline underline-offset-[3px] hover:text-ink"
          >
            Send it somewhere else
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="email" className="mb-[7px] block font-body text-[13px] font-medium text-body">
        Work email
      </label>
      <div className="edge flex items-center gap-2 rounded-[12px] bg-white py-[5px] pl-[14px] pr-[5px]">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="you@yourstartup.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'sign-in-error' : 'sign-in-note'}
          className="min-w-0 flex-1 border-0 bg-transparent py-[11px] font-body text-[15px] text-ink outline-none placeholder:text-subtle"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="edge cursor-pointer whitespace-nowrap rounded-[9px] bg-ink px-4 py-[10px] font-body text-[14px] font-bold text-white transition-colors duration-150 hover:bg-violet disabled:cursor-progress disabled:opacity-70"
        >
          {state === 'sending' ? 'Sending the link' : 'Send link'}
        </button>
      </div>
      {error ? (
        <p id="sign-in-error" role="alert" className="mt-[14px] font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : (
        <p id="sign-in-note" className="mt-[14px] font-mono text-[12.5px] text-subtle">
          No password. We email a link that signs you in.
        </p>
      )}
    </form>
  );
}
