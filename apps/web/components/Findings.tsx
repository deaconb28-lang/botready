/**
 * "What to fix, worst first."
 *
 * A ledger rather than a stack of cards: each finding is a section under a
 * hairline, with a 3px status-coloured rule down its left edge. Severity is
 * never a background fill, because a wall of tinted cards makes the worst
 * finding indistinguishable from the third worst.
 *
 * The evidence is the raw request or the raw counts, printed as they happened.
 * It is the part a reader forwards to whoever owns the WAF.
 */

import type { Finding } from '@botready/core';

import { EvidenceBlock, SectionHeading } from './primitives';

const RULE = {
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

export function Findings({ findings, pointsLostTotal }: { findings: Finding[]; pointsLostTotal: number }) {
  if (findings.length === 0) {
    return (
      <section className="mt-14">
        <SectionHeading kicker="Findings">Nothing to fix</SectionHeading>
        <p className="mt-3 text-[15px] text-ink-60">
          Every check in the catalog passed. That is rare enough that we would like to know how you
          did it.
        </p>
      </section>
    );
  }

  const top = findings.slice(0, 3);
  const topPoints = top.reduce((sum, f) => sum + f.pointsLost, 0);

  return (
    <section className="mt-14">
      <SectionHeading kicker={`${findings.length} ${findings.length === 1 ? 'check' : 'checks'} did not pass`}>
        What to fix, worst first
      </SectionHeading>
      {top.length > 1 && topPoints > 0 ? (
        <p className="mt-3 text-[15px] text-ink-60">
          These {top.length === 2 ? 'two' : 'three'} account for {topPoints} of the {pointsLostTotal} points
          you lost.
        </p>
      ) : null}

      <ol className="mt-8 list-none p-0">
        {findings.map((finding) => (
          <li key={finding.key}>
            <FindingRow finding={finding} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <article
      className={`border-t border-rule border-l-[3px] py-6 pl-5 sm:pl-7 ${RULE[finding.status]}`}
      aria-labelledby={`finding-${finding.key}`}
    >
      <div className="grid gap-x-10 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h3 id={`finding-${finding.key}`} className="text-[18px] font-semibold leading-[1.3]">
            {finding.headline}
          </h3>
          <p className="mt-2 max-w-[70ch] text-[14.5px] leading-[1.55] text-ink-60">{finding.body}</p>
        </div>
        <div className="mono text-[11px] text-ink-60 md:text-right">
          <span className={`inline-block rounded-[3px] border px-[7px] py-[2px] font-bold uppercase tracking-[0.06em] ${TAG[finding.status]}`}>
            {finding.status === 'error' ? 'could not run' : finding.pointsLost > 0 ? `−${finding.pointsLost} pts` : finding.status}
          </span>
          <p className="mt-2">{finding.category}</p>
          <p>{finding.key}</p>
        </div>
      </div>

      <EvidenceBlock label={`Evidence for: ${finding.label}`}>{finding.evidence}</EvidenceBlock>
    </article>
  );
}

/**
 * What already works, one line each. Not a victory lap: it tells a reader
 * which of the things they will read about elsewhere they can stop worrying
 * about.
 */
export function Passing({ passing }: { passing: Finding[] }) {
  if (passing.length === 0) return null;

  return (
    <section className="mt-14">
      <SectionHeading kicker={`${passing.length} ${passing.length === 1 ? 'check' : 'checks'} passed`}>
        What already works
      </SectionHeading>
      <ul className="mt-5 grid list-none grid-cols-1 gap-x-10 gap-y-1.5 p-0 sm:grid-cols-2">
        {passing.map((finding) => (
          <li key={finding.key} className="mono flex gap-3 border-b border-dashed border-rule py-1.5 text-[12.5px]">
            <span className="text-pass" aria-hidden="true">
              200
            </span>
            <span className="text-ink-60">{finding.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
