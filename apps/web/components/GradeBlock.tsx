/**
 * The signature element of the result page: the score rendered as an HTTP
 * response header block.
 *
 * No donut, no ring, no radial gauge. Semrush, Squarespace and Wix all lead
 * their audit screens with a percentage ring, and this reads as machine output
 * because that is what it is. The 20-segment meter counts discrete
 * measurements, which is what a check list is.
 *
 * It is the only inverted surface on the page, so it needs no border and no
 * shadow to stand out.
 */

import type { Grade } from '@botready/core';

import { GradeLetter, Meter } from './primitives';

export function GradeBlock({
  domain,
  checkedAt,
  grade,
  total,
  scoringVersion,
  verdict,
}: {
  domain: string;
  checkedAt: string;
  grade: Grade;
  total: number;
  scoringVersion: string;
  /** One sentence of fact, drawn from the worst finding. */
  verdict: string;
}) {
  // Two sizes, and which one applies is the viewport's business rather than the
  // caller's. The mobile frame in the mockup is the smaller of the two, and it
  // exists so the who-gets-in table still clears the fold on a 390px screen.
  return (
    <div className="on-ink rounded-[6px] bg-ink p-5 font-data text-[12px] leading-[1.75] text-paper sm:px-7 sm:py-[26px] sm:text-[13.5px] sm:leading-[1.85]">
      <p>
        <Key>site</Key> {domain}
      </p>
      <p>
        <Key>checked</Key> {checkedAt}
      </p>

      <GradeLetter grade={grade} width={122} className="my-2.5 text-[58px] sm:my-3 sm:text-[78px]" />

      <p>
        <Key>score</Key> {total} / 100 · <Key>scoring</Key> v{scoringVersion}
      </p>

      <div className="my-3">
        <Meter value={total} segments={20} onInk label="Overall score" />
      </div>

      {verdict ? (
        <p className="mt-3">
          <Key>verdict</Key> {verdict}
        </p>
      ) : null}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-key">{children}</span>;
}

/**
 * The same block for a scan that did not produce a score. A blocked site still
 * gets a header block, because "this site refuses our scanner" is a result and
 * not an error, and it is the one the index will show alongside everyone else's
 * grade.
 */
export function StatusBlock({
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
    <div className="on-ink rounded-[6px] bg-ink px-7 py-[26px] font-data text-[13.5px] leading-[1.85] text-paper">
      <p>
        <Key>site</Key> {domain}
      </p>
      <p>
        <Key>checked</Key> {checkedAt}
      </p>
      <p
        className={`mt-4 mb-2 font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] ${
          tone === 'fail' ? 'text-fail-dark' : 'text-warn'
        }`}
        style={{ fontVariationSettings: "'wdth' 114" }}
      >
        {headline}
      </p>
      <p className="max-w-[60ch] text-ink-key">{detail}</p>
    </div>
  );
}
