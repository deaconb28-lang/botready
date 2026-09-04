'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { cx } from '@/components/ui';

/**
 * Re-runs the scan for a claimed domain. The button says "Scanning…" while
 * the request is in flight, then the live page takes over and comes back
 * here when the result lands.
 */
export function RerunButton({ domain, next, label = 'Re-run scan', tone = 'white' }: { domain: string; next: string; label?: string; tone?: 'white' | 'lime' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: `https://${domain}/`, force: true }),
      });
      const body = (await res.json()) as { scanId?: string; error?: string };
      if (!res.ok || !body.scanId) {
        setError(body.error ?? `The scan could not be started (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      router.push(`/scan/live?id=${body.scanId}&next=${encodeURIComponent(next)}`);
    } catch {
      setError('The request did not reach us. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={cx(
          'edge cursor-pointer whitespace-nowrap rounded-full px-[22px] py-3 font-body text-[14.5px] font-bold shadow-hard-3 disabled:cursor-progress',
          busy ? 'bg-canvas text-subtle' : tone === 'lime' ? 'bg-lime text-ink hover:bg-white' : 'bg-white text-ink hover:bg-lime',
        )}
      >
        {busy ? 'Scanning…' : label}
      </button>
      {error ? (
        <span role="alert" className="max-w-[40ch] text-right font-mono text-[12px] text-coral-text">
          {error}
        </span>
      ) : null}
    </div>
  );
}
