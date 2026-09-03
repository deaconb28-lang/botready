/**
 * The paywall.
 *
 * Never blurs the score. The diagnosis above it is free and fully visible; the
 * paid artifact is the generated files. What this shows is a real llms.txt,
 * built from the reader's own domain and their own page titles, cut off mid-line.
 * A blurred score is annoying. A real file stopping mid-thought is a
 * demonstration.
 *
 * It borrows the ink surface — the same material as the grade band — because it
 * is the other thing on the page that is ours rather than the site's.
 */

import { previewOf, type FixFile, type PunchItem } from '@botready/core';

import { PRICING } from '@/lib/site';
import { Measure, buttonClass } from './primitives';

export function Paywall({
  scanId,
  domain,
  preview,
  punchList,
  fileCount,
  owned = false,
}: {
  scanId: string;
  domain: string;
  preview: FixFile;
  punchList: PunchItem[];
  fileCount: number;
  owned?: boolean;
}) {
  const { text, truncated } = previewOf(preview, 10);
  const quickWins = punchList.filter((item) => item.effort === 'minutes');
  const quickPoints = quickWins.reduce((sum, item) => sum + item.pointsRecovered, 0);
  const moreLines = Math.max(0, preview.content.trimEnd().split('\n').length - 10);

  return (
    <section className="on-ink mt-14 bg-ink text-paper" aria-labelledby="paywall-heading">
      <Measure wide className="grid gap-10 py-10 sm:py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <p className="label text-ink-key">{owned ? 'Your fix pack' : 'The fix pack'}</p>
          <h2 id="paywall-heading" className="display-section mt-3 text-[28px] sm:text-[34px]">
            {owned ? 'Generated and ready' : 'Get the files, not just the verdict'}
          </h2>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.55] text-ink-key">
            {owned ? (
              <>
                {fileCount} generated {fileCount === 1 ? 'file' : 'files'} and a punch list, built from
                this scan of {domain}.
              </>
            ) : (
              <>
                A generated llms.txt built from your real pages, the corrected robots.txt block naming
                the agents currently refused, the link tags for your top 20 URLs, and a JSON-LD block
                filled in from your own data.
              </>
            )}
          </p>
          {!owned && quickWins.length > 0 ? (
            <p className="wire-line mt-4 text-paper">
              {quickWins.length} of the {punchList.length} {punchList.length === 1 ? 'item' : 'items'}{' '}
              {quickWins.length === 1 ? 'is' : 'are'} minutes of work, worth {quickPoints}{' '}
              {quickPoints === 1 ? 'point' : 'points'}.
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-end gap-x-6 gap-y-4">
            {!owned ? (
              <p className="display-hero text-[44px] text-paper">
                {PRICING.fixpack.label}
                <span className="mono ml-2 text-[12px] font-normal tracking-[0.04em] text-ink-key">
                  {PRICING.fixpack.cadence}
                </span>
              </p>
            ) : null}
            <a
              href={owned ? `/api/fixpack/${scanId}` : `/api/checkout/${scanId}`}
              className={buttonClass('paper', 'md')}
              {...(owned ? { download: `botready-fixpack-${domain}.zip` } : {})}
            >
              {owned ? 'Download the fix pack' : 'Get the fix pack'}
            </a>
          </div>
        </div>

        <figure className="relative m-0 min-w-0">
          <figcaption className="label text-ink-key">
            {preview.name} · generated for {domain}
            {truncated ? ' · cut off' : ''}
          </figcaption>
          <pre className="wire-line mt-3 overflow-x-auto text-paper">{text}</pre>
          {truncated ? (
            <>
              {/* Over the band's own background, and only under the text, so
                  nothing legible is obscured and nothing is blurred. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-6 h-16 bg-gradient-to-b from-transparent to-ink"
              />
              <p className="wire-line relative mt-2 text-ink-key">
                {moreLines} more {moreLines === 1 ? 'line' : 'lines'}, and {fileCount - 1} more{' '}
                {fileCount - 1 === 1 ? 'file' : 'files'}, in the pack.
              </p>
            </>
          ) : null}
        </figure>
      </Measure>
    </section>
  );
}
