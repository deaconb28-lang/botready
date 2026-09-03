/**
 * "What to fix, worst first."
 *
 * Two rules from tokens.css govern the look, and both are about legibility
 * rather than taste:
 *
 *   Findings carry a 3px left border in the status colour. Severity is never a
 *   background fill, because a wall of tinted cards makes the worst finding
 *   indistinguishable from the third worst.
 *
 *   The evidence block is the raw request or the raw counts, printed as they
 *   happened, in mono. It is the part a reader forwards to whoever owns the WAF.
 */

import type { Finding } from '@botready/core';

import { EvidenceBlock } from './primitives';

const LEFT_BORDER = {
  fail: 'border-l-fail',
  warn: 'border-l-warn',
  // An error is not the site's failure. Plum is the reserved-5xx colour and it
  // reads as "something went wrong on the way", which is exactly the case.
  error: 'border-l-server',
  pass: 'border-l-pass',
  skip: 'border-l-rule',
} as const;

const TAG = {
  fail: 'text-fail border-fail',
  warn: 'text-warn border-warn',
  error: 'text-server border-server',
  pass: 'text-pass border-pass',
  skip: 'text-ink-60 border-rule',
} as const;

export function Findings({
  findings,
  pointsLostTotal,
}: {
  findings: Finding[];
  pointsLostTotal: number;
}) {
  if (findings.length === 0) {
    return (
      <section className="mt-9">
        <h2 className="text-[20px] font-bold">Nothing to fix</h2>
        <p className="mt-0.5 text-[14px] text-ink-60">
          Every check in the catalog passed. That is rare enough that we would like to know how you
          did it.
        </p>
      </section>
    );
  }

  const top = findings.slice(0, 3);
  const topPoints = top.reduce((sum, f) => sum + f.pointsLost, 0);

  return (
    <section className="mt-9">
      <h2 className="text-[20px] font-bold">What to fix, worst first</h2>
      <p className="mt-0.5 mb-[18px] text-[14px] text-ink-60">
        {findings.length} {findings.length === 1 ? 'check' : 'checks'} did not pass.
        {top.length > 1 && topPoints > 0 ? (
          <>
            {' '}
            These {top.length === 2 ? 'two' : 'three'} account for {topPoints} of the{' '}
            {pointsLostTotal} points you lost.
          </>
        ) : null}
      </p>

      <ol className="list-none p-0">
        {findings.map((finding) => (
          <li key={finding.key}>
            <FindingCard finding={finding} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article
      className={`mb-2.5 rounded-[5px] border border-rule border-l-[3px] bg-card px-[18px] py-4 ${
        LEFT_BORDER[finding.status]
      }`}
      aria-labelledby={`finding-${finding.key}`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 id={`finding-${finding.key}`} className="text-[15.5px] font-semibold">
          {finding.headline}
        </h3>
        <span
          className={`shrink-0 rounded-[3px] border px-[7px] py-[2px] font-data text-[10.5px] font-bold uppercase tracking-[0.06em] ${
            TAG[finding.status]
          }`}
        >
          {finding.status === 'error'
            ? 'could not run'
            : finding.pointsLost > 0
              ? `−${finding.pointsLost} pts`
              : finding.status}
        </span>
      </div>

      <p className="mt-[7px] max-w-[74ch] text-[13.5px] text-ink-60">{finding.body}</p>

      <EvidenceBlock label={`Evidence for: ${finding.label}`}>{finding.evidence}</EvidenceBlock>

      <p className="mt-2.5 font-data text-micro text-ink-60">
        {finding.label} · {finding.category}
      </p>
    </article>
  );
}

/**
 * The short list of what already works. Not a victory lap: it tells a reader
 * which of the things they will read about elsewhere they can stop worrying
 * about, which is worth a line each and no more.
 */
export function Passing({ passing }: { passing: Finding[] }) {
  if (passing.length === 0) return null;

  return (
    <section className="mt-9">
      <h2 className="text-[20px] font-bold">What already works</h2>
      <p className="mt-0.5 mb-3.5 text-[14px] text-ink-60">
        {passing.length} {passing.length === 1 ? 'check' : 'checks'} passed.
      </p>
      <ul className="grid list-none grid-cols-1 gap-x-8 gap-y-1.5 p-0 sm:grid-cols-2">
        {passing.map((finding) => (
          <li key={finding.key} className="flex gap-2.5 font-data text-[12.5px]">
            <span className="text-pass" aria-hidden="true">
              ✓
            </span>
            <span className="text-ink-60">{finding.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
