'use client';

import { useState } from 'react';

export function SignInForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(
    initialError === 'missing-code'
      ? 'That link was missing its code. Request a new one below.'
      : initialError,
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
        setError(body.error ?? `The sign-in email could not be sent (HTTP ${res.status}).`);
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
      <p role="status" className="mt-6 rounded-[5px] border border-pass border-l-[3px] bg-card px-[18px] py-4 text-[14px]">
        The link is on its way to <span className="font-data">{email}</span>. Open it on this
        device to continue. It works once and expires in an hour.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6">
      <label htmlFor="email" className="block font-data text-[12px] uppercase tracking-[0.1em] text-ink-60">
        Email
      </label>
      <div className="mt-2 flex overflow-hidden rounded-[5px] border-[1.5px] border-ink bg-card">
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'sign-in-error' : undefined}
          className="w-full flex-1 border-0 bg-transparent px-4 py-[13px] font-data text-[14px] text-ink outline-none"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="cursor-pointer border-0 border-l-[1.5px] border-ink bg-ink px-5 font-body font-semibold text-paper disabled:cursor-progress disabled:opacity-70"
        >
          {state === 'sending' ? 'Sending the link' : 'Send the link'}
        </button>
      </div>
      {error ? (
        <p id="sign-in-error" role="alert" className="mt-2.5 font-data text-[12.5px] font-medium text-fail">
          {error}
        </p>
      ) : null}
    </form>
  );
}
