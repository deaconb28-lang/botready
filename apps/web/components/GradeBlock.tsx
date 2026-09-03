/**
 * The grade band.
 *
 * The score rendered as an HTTP response header block, full width, in ink. No
 * donut, no ring, no radial gauge: the 20-segment meter counts discrete
 * measurements, which is what a check list is. It is the only inverted surface
 * on the result page, which is why it needs no border or shadow, and why the
 * who-gets-in status lines live inside it rather than beside it — five
 * responses to one request are the same material as the grade.
 */

import type { ReactNode } from 'react';

import type { Grade } from '@botready/core';

import { GradeLetter, Measure, Meter } from './primitives';

export function GradeBand({
  domain,
  checkedAt,
  grade,
  total,
  scoringVersion,
  verdict,
  aside,
}: {
  domain: string;
  checkedAt: string;
  grade: Grade;
  total: number;
  scoringVersion: string;
  /** One sentence of fact, drawn from the worst finding. */
  verdict: string;
  /** The who-gets-in block, rendered on the band's right. */
  aside?: ReactNode;
}) {
  return (
    <section className="on-ink bg-ink text-paper" aria-labelledby="grade-heading">
      <Measure wide className="grid gap-10 py-9 sm:py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="wire-line text-[13px] sm:text-[13.5px]">
          <p>
            <Key>site</Key> {domain}
          </p>
          <p>
            <Key>checked</Key> {checkedAt}
          </p>

          <h2 id="grade-heading" className="sr-only">
            Grade {grade}, {total} out of 100
          </h2>
          <GradeLetter grade={grade} className="my-4 text-[96px] sm:my-5 sm:text-[128px]" />

          <p>
            <Key>score</Key> {total} / 100 · <Key>scoring</Key> v{scoringVersion}
          </p>
          <div className="my-3.5 max-w-[520px]">
            <Meter value={total} segments={20} onInk animate label="Overall score" />
          </div>
          {verdict ? (
            <p className="max-w-[52ch]">
              <Key>verdict</Key> {verdict}
            </p>
          ) : null}
        </div>

        {aside ? <div className="lg:border-l lg:border-ink-seg lg:pl-12">{aside}</div> : null}
      </Measure>
    </section>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <span className="text-ink-key">{children}</span>;
}

/**
 * The same band for a scan that did not produce a score. A blocked site still
 * gets one, because "this site refuses our scanner" is a result and not an
 * error, and it is the one the index shows alongside everyone else's grade.
 */
export function StatusBand({
  domain,
  checkedAt,
  headline,
  detail,
  tone = 'fail',
}: {
  domain: string;
  checkedAt: string;
  headline: string;
  detail: string;
  tone?: 'fail' | 'warn';
}) {
  return (
    <section className="on-ink bg-ink text-paper">
      <Measure wide className="py-9 sm:py-12">
        <div className="wire-line text-[13px] sm:text-[13.5px]">
          <p>
            <Key>site</Key> {domain}
          </p>
          <p>
            <Key>checked</Key> {checkedAt}
          </p>
        </div>
        <h2
          className={`display-hero mt-6 max-w-[16ch] text-[34px] sm:text-[52px] ${
            tone === 'fail' ? 'text-fail-dark' : 'text-[#D69A5C]'
          }`}
        >
          {headline}
        </h2>
        <p className="wire-line mt-5 max-w-[64ch] text-ink-key">{detail}</p>
      </Measure>
    </section>
  );
}
