'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Chip, cx } from '@/components/ui';
import type { PromptRow } from '@/lib/app-data';
import { relativeTime } from '@/lib/theme';

/**
 * The watched prompts and what the last answer said.
 *
 * The excerpt is the assistant's own words, labelled as such. It is a
 * measurement of an answer engine, not a finding about the site, and nothing
 * here feeds the score.
 */
export function PromptWatchView({
  siteId,
  domain,
  prompts,
  configured,
  weekly,
}: {
  siteId: string;
  domain: string;
  prompts: PromptRow[];
  configured: boolean;
  weekly: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState<'add' | 'run' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const text = value.trim();
    if (!text) {
      setError('Write the question the way a buyer would ask it.');
      return;
    }
    setBusy('add');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId, text }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `That could not be saved (HTTP ${res.status}).`);
        return;
      }
      setValue('');
      router.refresh();
    } catch {
      setError('The request did not reach us. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function runAll() {
    if (busy) return;
    setBusy('run');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/prompts/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const body = (await res.json()) as { asked?: number; cited?: number; errors?: number; error?: string };
      if (!res.ok) {
        setError(body.error ?? `The prompts could not be asked (HTTP ${res.status}).`);
        return;
      }
      setNotice(`Asked ${body.asked} ${body.asked === 1 ? 'prompt' : 'prompts'}. ${domain} was cited in ${body.cited} of them.${body.errors ? ` ${body.errors} failed.` : ''}`);
      router.refresh();
    } catch {
      setError('The request did not reach us. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    await fetch('/api/prompts', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ siteId, id }) });
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={add} noValidate className="mb-4">
        <div className="edge flex flex-wrap items-center gap-2 rounded-[11px] bg-white py-[5px] pl-[15px] pr-[5px]">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="best issue tracker for a small team"
            aria-label="A question to watch"
            maxLength={200}
            className="min-w-[200px] flex-1 border-0 bg-transparent py-[10px] font-body text-[15px] text-ink outline-none placeholder:text-subtle"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="edge cursor-pointer whitespace-nowrap rounded-[9px] bg-white px-4 py-[9px] font-body text-[13.5px] font-bold text-ink hover:bg-lime disabled:cursor-progress"
          >
            {busy === 'add' ? 'Saving…' : 'Watch this prompt'}
          </button>
          <button
            type="button"
            onClick={runAll}
            disabled={busy !== null || prompts.length === 0 || !configured}
            className="edge cursor-pointer whitespace-nowrap rounded-[9px] bg-lime px-4 py-[9px] font-body text-[13.5px] font-bold text-ink shadow-hard-2 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'run' ? 'Asking…' : 'Ask them now'}
          </button>
        </div>
      </form>

      {!configured ? (
        <p className="mb-3 font-mono text-[12.5px] text-amber-text">
          Prompt watch is not configured on this deployment: ANTHROPIC_API_KEY is not set, so no prompt is being asked.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 font-mono text-[12.5px] font-medium text-coral-text">
          {error}
        </p>
      ) : notice ? (
        <p role="status" className="mb-3 font-mono text-[12.5px] text-green-text">
          {notice}
        </p>
      ) : null}

      {prompts.length === 0 ? (
        <div className="edge rounded-[14px] bg-white p-6 shadow-hard-4">
          <p className="text-[15px] leading-[1.6] text-body">
            No prompts yet. Add the questions your buyers actually ask an assistant — &ldquo;best issue tracker for a small team&rdquo;, &ldquo;lightweight alternative to Jira&rdquo; — and we
            record whether the answer names you.
          </p>
        </div>
      ) : (
        <div className="edge overflow-hidden rounded-[14px] bg-white shadow-hard-4">
          {prompts.map((p, i) => {
            const isOpen = open === p.id;
            return (
              <div key={p.id} className={cx(i < prompts.length - 1 && 'border-b-2 border-rule')}>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="min-w-[200px] flex-1 text-[15px]">{p.text}</span>
                  <span className="whitespace-nowrap font-mono text-[12px] text-subtle">{p.latest ? relativeTime(p.latest.ranAt) : 'not asked yet'}</span>
                  {p.latest ? (
                    <Chip tone={p.latest.error ? 'warn' : p.latest.cited ? 'ok' : 'bad'}>{p.latest.error ? 'failed' : p.latest.cited ? 'cited' : 'not cited'}</Chip>
                  ) : (
                    <Chip tone="neutral">pending</Chip>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : p.id)}
                    aria-expanded={isOpen}
                    disabled={!p.latest}
                    className="cursor-pointer border-0 bg-transparent p-0 font-body text-[13px] font-medium text-violet underline underline-offset-[3px] disabled:cursor-default disabled:text-subtle disabled:no-underline"
                  >
                    {isOpen ? 'Hide answer' : 'Show answer'}
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className="cursor-pointer border-0 bg-transparent p-0 font-body text-[13px] font-medium text-muted underline underline-offset-[3px] hover:text-coral-text">
                    Remove
                  </button>
                </div>
                {isOpen && p.latest ? (
                  <div className="anim-rise-fast border-t border-rule bg-surface-alt px-5 py-4">
                    <p className="font-mono text-[11.5px] tracking-[0.1em] text-subtle uppercase">The assistant&rsquo;s answer · {p.latest.model}</p>
                    {p.latest.error ? (
                      <p className="mt-2 text-[14px] text-coral-text">{p.latest.error}</p>
                    ) : (
                      <>
                        <p className="mt-2 max-w-[80ch] text-[14.5px] leading-[1.6] text-body">{p.latest.excerpt || 'The answer came back empty.'}</p>
                        <p className="mt-3 font-mono text-[12px] text-subtle">
                          cited: {p.latest.citedDomains.length > 0 ? p.latest.citedDomains.join(', ') : 'nothing'}
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 max-w-[74ch] text-[13.5px] leading-[1.6] text-quiet">
        {weekly ? 'We ask these every week and keep every answer.' : 'On the free plan we ask these when you press the button; monitoring asks them weekly.'} The excerpt is the
        assistant&rsquo;s own words. It measures the answer engine, not your site, and it never changes your score.
      </p>
    </div>
  );
}
