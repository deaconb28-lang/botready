'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button, Card, cx } from '@/components/ui';
import type { ClaimInstructions } from '@/lib/claims';

type Method = 'dns' | 'meta';

/**
 * Proving control, walked through rather than listed.
 *
 * What was here before was correct and unhelpful: two cards of facts and a
 * button. Somebody who has never added a TXT record cannot tell from that
 * whether they need both options or one, where a "host" goes, or why the check
 * failed thirty seconds after they saved the record.
 *
 * So: one method at a time, numbered steps, and every value that has to be
 * typed exactly is a copy button instead. The three things that actually trip
 * people up each get a sentence where they will hit them — that either method
 * is enough, that most DNS panels want the short host, and that DNS takes a
 * few minutes to propagate.
 */
export function ClaimForm({ domain, instructions }: { domain: string; instructions: ClaimInstructions }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('dns');
  const [state, setState] = useState<'idle' | 'checking'>('idle');
  const [error, setError] = useState<string | null>(null);

  /**
   * Switching method clears the last failure. The advice under an error is
   * written for the method that is showing, so leaving a DNS failure on screen
   * beneath a list of meta tag suggestions reads as a diagnosis of the thing
   * the reader has not tried yet.
   */
  function choose(next: Method) {
    setMethod(next);
    setError(null);
  }

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
      <p className="max-w-[62ch] text-[15.5px] leading-[1.6] text-muted">
        Anyone can type a domain name. Only the person who controls {domain} can put a value we chose where we said. Pick
        whichever of these you can do faster — <strong className="font-semibold text-ink">either one is enough</strong>,
        you do not need both.
      </p>

      <div className="mt-6 flex flex-wrap gap-[10px]" role="group" aria-label="How to prove control">
        <MethodButton active={method === 'dns'} onClick={() => choose('dns')} hint="No deploy needed">
          Add a DNS record
        </MethodButton>
        <MethodButton active={method === 'meta'} onClick={() => choose('meta')} hint="If you can deploy the site">
          Add a meta tag
        </MethodButton>
      </div>

      <Card as="section" shadow={4} radius="panel" className="mt-5 p-[26px]">
        {method === 'dns' ? (
          <DnsSteps instructions={instructions} status={state === 'checking' ? 'checking' : error ? 'missing' : 'pending'} />
        ) : (
          <MetaSteps instructions={instructions} domain={domain} />
        )}

        <Step n={3} title="Come back and check">
          <p>
            {method === 'dns'
              ? 'New DNS records usually appear within a few minutes, sometimes longer. If the check comes back empty, wait a minute and press it again — nothing is lost by checking twice.'
              : 'As soon as the change is live on the homepage, this will find it.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="button" tone="lime" size="lg" shadow={3} onClick={check} disabled={state === 'checking'}>
              {state === 'checking' ? 'Looking for it…' : 'Check for the token'}
            </Button>
            <span className="font-mono text-[12px] text-subtle-2" aria-live="polite">
              {state === 'checking' ? `Reading ${method === 'dns' ? 'DNS' : 'the homepage'} now` : ''}
            </span>
          </div>

          {error ? (
            <div role="alert" className="edge mt-4 overflow-hidden rounded-[12px] bg-coral-tint">
              <p className="px-4 py-[14px] text-[14.5px] leading-[1.55] font-medium text-ink">{error}</p>
              <div className="border-t-2 border-ink bg-white px-4 py-[13px]">
                <p className="eyebrow text-subtle-2">Worth checking</p>
                <ul className="m-0 mt-2 grid list-none gap-[6px] p-0 text-[13.5px] leading-[1.5] text-muted">
                  {(method === 'dns'
                    ? [
                        'The host is the short form your panel expects — most add the domain themselves.',
                        'The type is TXT, not CNAME and not A.',
                        'The value was pasted whole. It starts with botready-verify=.',
                      ]
                    : [
                        'The tag is in the HTML the server sends, not added later by JavaScript.',
                        'It is on the homepage itself rather than a page the homepage redirects to.',
                        'The change is deployed, not only committed.',
                      ]
                  ).map((line) => (
                    <li key={line} className="grid grid-cols-[10px_1fr] gap-[9px]">
                      <span aria-hidden="true" className="mt-[7px] h-[5px] w-[5px] rounded-full bg-placeholder" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </Step>
      </Card>

      <p className="mt-5 max-w-[62ch] text-[13.5px] leading-[1.6] text-subtle-2">
        Once it verifies you can leave the record or the tag in place — we re-read it on later checks — and{' '}
        {domain} shows as claimed. Nothing about the token is secret: it is only useful to the account it was made for.
      </p>
    </div>
  );
}

function DnsSteps({ instructions, status }: { instructions: ClaimInstructions; status: RecordStatus }) {
  return (
    <>
      <Step n={1} title="Open the DNS settings for this domain">
        <p>
          Wherever the domain&rsquo;s nameservers live: Cloudflare, Namecheap, Vercel, Route 53, Squarespace, or whoever
          you bought it from. Look for &ldquo;DNS&rdquo;, &ldquo;Records&rdquo; or &ldquo;Advanced DNS&rdquo;, then add a
          record.
        </p>
      </Step>

      <Step n={2} title="Add this record" wide>
        <RecordTable instructions={instructions} status={status} />
        {/* A note about the form as a whole, so it is separated from the
            per-field notes above it, which look identical otherwise. */}
        <Tip>
          Leave TTL at whatever it offers. If a field called &ldquo;name&rdquo; appears instead of
          &ldquo;host&rdquo;, it is the same thing.
        </Tip>
      </Step>
    </>
  );
}

function MetaSteps({ instructions, domain }: { instructions: ClaimInstructions; domain: string }) {
  return (
    <>
      <Step n={1} title="Put this tag in the homepage's <head>">
        <CopyField label="Meta tag" value={instructions.meta.tag} wrap />
        <Tip>
          Anywhere inside <code className="font-mono text-ink">&lt;head&gt;</code> is fine. In Next.js it can go in the
          root layout&rsquo;s metadata; in most other frameworks it is the same file the title tag is in.
        </Tip>
      </Step>

      <Step n={2} title="Deploy it">
        <p>
          It has to be live at <span className="font-mono text-ink">https://{domain}/</span>, in the HTML the server
          sends. We read the response the way any client would and we do not run JavaScript, so a tag injected in the
          browser will not be found.
        </p>
      </Step>
    </>
  );
}

function Step({ n, title, children, wide = false }: { n: number; title: string; children: ReactNode; wide?: boolean }) {
  return (
    // minmax(0,1fr), not 1fr: a plain `1fr` track is sized by its content, so
    // the record table refused to shrink on a phone and pushed the whole
    // document sideways instead of scrolling inside its own overflow-x-auto.
    <div className={cx('grid grid-cols-[28px_minmax(0,1fr)] gap-x-[14px] gap-y-2', n > 1 ? 'mt-7 border-t border-hairline pt-7' : '')}>
      <span
        aria-hidden="true"
        className="edge grid h-[28px] w-[28px] place-items-center rounded-full bg-violet font-mono text-[13px] font-bold text-white"
      >
        {n}
      </span>
      <h3 className="display self-center text-[17px] font-semibold">
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      {/* 58ch is a reading measure and it is right for the prose. A table is
          not prose: constrained to it, the value column collapses to four
          characters and an ellipsis. */}
      <div className={cx('col-start-2 text-[14.5px] leading-[1.6] text-muted [&_p]:m-0', wide ? '' : 'max-w-[58ch]')}>{children}</div>
    </div>
  );
}

type RecordStatus = 'pending' | 'checking' | 'missing';

const STATUS_TEXT: Record<RecordStatus, string> = {
  pending: 'Pending',
  checking: 'Checking',
  missing: 'Not found',
};

/**
 * The record as a DNS panel thinks of it: one row, the columns it will ask for,
 * in its order.
 *
 * This was four stacked labelled fields, which is a form rather than a record —
 * it reads as four things to do instead of one, and it does not look like
 * anything the person is about to be shown in Cloudflare or Route 53. Every
 * host that asks you to prove a domain lays this out as a table, so their eyes
 * already know where to look.
 *
 * One row, because it is one record. The fully qualified name is offered under
 * the table rather than as a second row: two rows would read as two records to
 * add, and adding both is the mistake this whole panel exists to prevent.
 */
function RecordTable({ instructions, status }: { instructions: ClaimInstructions; status: RecordStatus }) {
  return (
    <div className="mt-4">
      <div className="edge overflow-hidden rounded-[12px] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink bg-surface-alt">
                <Th>Type</Th>
                <Th>Name</Th>
                <Th>Value</Th>
                <Th>TTL</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-middle">
                <Td>
                  <span className="font-mono text-[13px] font-medium text-ink">TXT</span>
                </Td>
                <Td>
                  <CopyCell value={instructions.dns.hostShort} />
                </Td>
                <Td wide>
                  <CopyCell value={instructions.dns.value} />
                </Td>
                <Td>
                  <span className="font-mono text-[13px] text-subtle-2">Auto</span>
                </Td>
                <Td>
                  <span
                    className={cx(
                      'edge inline-block whitespace-nowrap rounded-[7px] px-[8px] py-[2px] font-mono text-[11.5px] font-medium text-ink',
                      status === 'missing' ? 'bg-coral-tint' : status === 'checking' ? 'bg-amber' : 'bg-canvas',
                    )}
                  >
                    {STATUS_TEXT[status]}
                  </span>
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-[10px] flex flex-wrap items-center gap-x-[10px] gap-y-1 text-[13px] leading-[1.5] text-subtle-2">
        <span>Panel wants the whole name instead?</span>
        <span className="font-mono text-ink">{instructions.dns.host}</span>
        <CopyButton value={instructions.dns.host} label="the full name" />
      </p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="eyebrow whitespace-nowrap px-[12px] py-[10px] text-subtle-2">
      {children}
    </th>
  );
}

/**
 * `wide` is the value column. `w-full max-w-0` is the table-cell way of saying
 * "take the leftover width and let your contents truncate inside it" — without
 * max-w-0 a cell is sized by its content, so a 47-character token wraps to
 * three lines and shoulders the Status column off the end of the table.
 */
function Td({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <td className={cx('px-[12px] py-[12px]', wide ? 'w-full max-w-0' : 'whitespace-nowrap')}>{children}</td>;
}

/**
 * A value with its own copy button, so a row can be lifted a field at a time.
 * One line always: the whole point of the button is that nobody has to read
 * the token, and a wrapped token makes the row taller than the information in
 * it deserves.
 */
function CopyCell({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-[10px]">
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink" title={value}>
        {value}
      </span>
      <CopyButton value={value} label={value} />
    </span>
  );
}

/** Advice about the step rather than about one field, and set apart from it. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 border-t border-dashed border-divider pt-3 text-[13.5px] leading-[1.55] text-muted">{children}</p>
  );
}

/** The one copy control, used by the table cells and by the meta tag. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // A clipboard the browser will not hand over is not an error: the value
      // is on the page and selectable, which is how this worked before.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="edge shrink-0 cursor-pointer rounded-[8px] bg-white px-[10px] py-[5px] font-mono text-[11.5px] font-medium text-ink transition-colors duration-150 hover:bg-lime"
    >
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      <span className="sr-only"> {label}</span>
    </button>
  );
}

/** A value that has to be typed exactly, so it is never typed. */
function CopyField({ label, value, note, wrap = false }: { label: string; value: string; note?: string; wrap?: boolean }) {
  return (
    <div className="mt-3 first:mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-subtle-2">{label}</span>
        <CopyButton value={value} label={label} />
      </div>
      <p
        className={cx(
          'edge mt-[6px] rounded-[10px] bg-surface-alt px-[13px] py-[10px] font-mono text-[13px] leading-[1.5] text-ink',
          wrap ? 'break-all whitespace-pre-wrap' : 'overflow-x-auto whitespace-nowrap',
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-[6px] text-[13px] leading-[1.5] text-subtle-2">{note}</p> : null}
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  hint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hint: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'edge cursor-pointer rounded-[12px] px-[16px] py-[11px] text-left transition-all duration-150',
        active ? 'bg-violet text-white shadow-hard-3' : 'bg-white text-ink hover:-translate-y-[1px] hover:shadow-hard-3',
      )}
    >
      <span className="block font-body text-[14.5px] font-semibold">{children}</span>
      <span className={cx('mt-[2px] block font-mono text-[11px]', active ? 'text-on-violet-2' : 'text-subtle-2')}>{hint}</span>
    </button>
  );
}
