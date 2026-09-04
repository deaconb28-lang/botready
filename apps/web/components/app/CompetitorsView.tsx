'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cx } from '@/components/ui';
import type { CompetitorRow } from '@/lib/app-data';
import { scoreColorFor } from '@/lib/theme';

/**
 * The competitors table. Adding one scans it through the same pipeline, so
 * the number beside a competitor is the same measurement as your own.
 */
export function CompetitorsView({ siteId, rows }: { siteId: string; rows: CompetitorRow[] }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const domain = value.trim();
    if (!domain) {
      setError('Enter a domain to track.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId, domain }),
      });
      const body = (await res.json()) as { ok?: boolean; domain?: string; queued?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? `That could not be added (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      setValue('');
      setNotice(body.queued ? `${body.domain} is being scanned now. The score appears when it finishes.` : `${body.domain} was scanned recently, so its latest result is shown.`);
      router.refresh();
    } catch {
      setError('The request did not reach us. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(domain: string) {
    await fetch('/api/competitors', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteId, domain }),
    });
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={add} noValidate className="mb-4 flex flex-wrap items-center gap-3">
        <div className="edge flex min-w-[280px] flex-1 items-center gap-2 rounded-[11px] bg-white py-[5px] pl-[15px] pr-[5px]">
          <span aria-hidden="true" className="font-mono text-[14px] text-subtle">
            https://
          </span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="competitor.com"
            aria-label="Competitor domain"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent py-[10px] font-mono text-[14.5px] text-ink outline-none placeholder:text-subtle"
          />
          <button
            type="submit"
            disabled={busy}
            className="edge cursor-pointer whitespace-nowrap rounded-[9px] bg-lime px-4 py-[9px] font-body text-[13.5px] font-bold text-ink shadow-hard-2 hover:bg-white disabled:cursor-progress"
          >
            {busy ? 'Adding…' : 'Track a competitor'}
          </button>
        </div>
      </form>
      {error ? (
        <p role="alert" className="mb-3 font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : notice ? (
        <p role="status" className="mb-3 font-mono text-[12.5px] text-green-text">
          {notice}
        </p>
      ) : null}

      <div className="edge overflow-hidden rounded-[14px] bg-white shadow-hard-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">Competitors ranked by agent readability</caption>
            <thead>
              <tr className="border-b-2 border-ink bg-canvas font-mono text-[12px] font-medium tracking-[0.08em] text-body">
                <th scope="col" className="px-5 py-[13px] text-left">
                  DOMAIN
                </th>
                <th scope="col" className="px-3 py-[13px] text-right">
                  SCORE
                </th>
                <th scope="col" className="px-3 py-[13px] text-right">
                  AGENTS OK
                </th>
                <th scope="col" className="px-3 py-[13px] text-right">
                  CITED IN
                </th>
                <th scope="col" className="px-5 py-[13px] text-right">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.domain} className={cx('border-b-2 border-rule last:border-b-0', row.self ? 'bg-lime-tint' : 'hover:bg-[#FAFAFF]')}>
                  <td className="px-5 py-[15px] font-body text-[15.5px] font-semibold">
                    {row.scanId ? (
                      <Link href={`/scan/${row.scanId}`} className="text-ink no-underline hover:underline">
                        {row.domain}
                      </Link>
                    ) : (
                      row.domain
                    )}
                    {row.self ? <span className="ml-2 font-mono text-[12px] font-normal text-quiet">you</span> : null}
                  </td>
                  <td className="px-3 py-[15px] text-right font-mono text-[15px] font-bold" style={{ color: row.total === null ? '#8B90A0' : scoreColorFor(row.total) }}>
                    {row.total ?? (row.status === 'blocked' ? 'blocked' : row.status === 'pending' ? 'scanning' : '—')}
                  </td>
                  <td className="px-3 py-[15px] text-right font-mono text-[13px] text-quiet">{row.agentsOk ? `${row.agentsOk.ok} of ${row.agentsOk.of}` : '—'}</td>
                  <td className="px-3 py-[15px] text-right font-mono text-[13px] text-body">
                    {row.cited.of === 0 ? 'no prompts' : `${row.cited.count} of ${row.cited.of} prompts`}
                  </td>
                  <td className="px-5 py-[15px] text-right">
                    {row.self ? null : (
                      <button type="button" onClick={() => remove(row.domain)} className="cursor-pointer border-0 bg-transparent p-0 font-body text-[13px] font-medium text-muted underline underline-offset-[3px] hover:text-coral-text">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
