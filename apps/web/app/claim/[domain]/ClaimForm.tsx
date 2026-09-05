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
        {method === 'dns' ? <DnsSteps instructions={instructions} /> : <MetaSteps instructions={instructions} domain={domain} />}

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

function DnsSteps({ instructions }: { instructions: ClaimInstructions }) {
  return (
    <>
      <Step n={1} title="Open the DNS settings for this domain">
        <p>
          Wherever the domain&rsquo;s nameservers live: Cloudflare, Namecheap, Vercel, Route 53, Squarespace, or whoever
          you bought it from. Look for &ldquo;DNS&rdquo;, &ldquo;Records&rdquo; or &ldquo;Advanced DNS&rdquo;, then add a
          record.
        </p>
      </Step>

      <Step n={2} title="Add a TXT record with these values">
        <CopyField label="Host" value={instructions.dns.hostShort} note="What most panels want — they add the domain for you." />
        <CopyField
          label="Host, in full"
          value={instructions.dns.host}
          note="Use this instead only if your panel asks for the whole name."
        />
        <Field label="Type" value="TXT" note="Not CNAME, not A." />
        <CopyField label="Value" value={instructions.dns.value} wrap />
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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className={cx('grid grid-cols-[28px_1fr] gap-x-[14px] gap-y-2', n > 1 ? 'mt-7 border-t border-hairline pt-7' : '')}>
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
      <div className="col-start-2 max-w-[58ch] text-[14.5px] leading-[1.6] text-muted [&_p]:m-0">{children}</div>
    </div>
  );
}

/** Advice about the step rather than about one field, and set apart from it. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 border-t border-dashed border-divider pt-3 text-[13.5px] leading-[1.55] text-muted">{children}</p>
  );
}

/** A value that has to be typed exactly, so it is never typed. */
function CopyField({ label, value, note, wrap = false }: { label: string; value: string; note?: string; wrap?: boolean }) {
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
    <div className="mt-3 first:mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-subtle-2">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="edge shrink-0 cursor-pointer rounded-[8px] bg-white px-[10px] py-[5px] font-mono text-[11.5px] font-medium text-ink transition-colors duration-150 hover:bg-lime"
        >
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          <span className="sr-only"> {label}</span>
        </button>
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

/** A value short enough to read and retype, so it gets no button. */
function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="mt-3">
      <span className="eyebrow text-subtle-2">{label}</span>
      <p className="edge mt-[6px] rounded-[10px] bg-surface-alt px-[13px] py-[10px] font-mono text-[13px] leading-[1.5] text-ink">
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
