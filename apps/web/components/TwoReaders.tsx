/**
 * The signature element. Every competitor opens with a percentage ring. This
 * opens with the actual disagreement between two readers of the same URL, which
 * is the product thesis in one glance.
 *
 * It takes real numbers when a scan has produced them and falls back to the
 * illustrative pair on the landing page, where there is no scan yet. The
 * fallback is labelled as an example, because a made-up number presented as a
 * measurement is exactly the thing this product exists to complain about.
 */

import { statusClass } from '@botready/core';

export interface ReaderSide {
  heading: string;
  who: string;
  chars: number;
  status: number;
  verdict: string;
}

export function TwoReaders({
  left,
  right,
  example = false,
}: {
  left: ReaderSide;
  right: ReaderSide;
  example?: boolean;
}) {
  // Bars are drawn in proportion to the character counts, so the visual gap is
  // the measured gap rather than a decision made in CSS.
  const peak = Math.max(left.chars, right.chars, 1);

  return (
    <div>
      <div className="grid grid-cols-1 border-y border-ink md:grid-cols-2">
        <Reader side={left} peak={peak} />
        <div className="border-t border-ink md:border-l md:border-t-0">
          <Reader side={right} peak={peak} />
        </div>
      </div>
      {example ? (
        <p className="px-6 pt-3 font-data text-micro text-ink-30">
          An example, drawn from a real scan of a client-rendered site. Run a check to see
          your own.
        </p>
      ) : null}
    </div>
  );
}

function Reader({ side, peak }: { side: ReaderSide; peak: number }) {
  const fill = side.chars / peak;
  const cls = statusClass(side.status);
  const good = cls === '2xx' && fill > 0.5;

  // Eight rows, filled in proportion to how much of the peak this side got.
  const rows = [0.9, 1, 0.75, 1, 0.6, 0.9, 1, 0.4];
  const visible = Math.max(0, Math.round(rows.length * fill));

  return (
    <div className="px-[26px] pb-[26px] pt-[22px]">
      <h3 className="font-data text-[13px] font-bold uppercase tracking-[0.04em]">
        {side.heading}
      </h3>
      <p className="mb-4 font-data text-[12px] text-ink-60">
        {side.who} · {side.chars.toLocaleString('en-US')} chars
      </p>
      <div aria-hidden="true">
        {rows.map((width, i) => (
          <div
            key={i}
            className="mb-[9px] h-[7px] rounded-[2px] bg-ink"
            style={{
              width: i < visible ? `${width * 100}%` : `${Math.max(width * fill, 0) * 100}%`,
              opacity: i < visible ? 0.82 : 0.16,
            }}
          />
        ))}
      </div>
      <p
        className={`mt-[18px] border-t border-dashed border-rule pt-3 font-data text-[12px] font-bold ${
          good ? 'text-pass' : 'text-fail'
        }`}
      >
        {side.verdict}
      </p>
    </div>
  );
}
