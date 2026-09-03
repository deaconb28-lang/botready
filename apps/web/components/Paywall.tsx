/**
 * The paywall.
 *
 * Never blurs the score. The diagnosis above it is free and fully visible; the
 * paid artifact is the generated files. What this shows is a real llms.txt,
 * built from the reader's own domain and their own page titles, cut off part
 * way through. A blurred score is annoying. A real file stopping mid-line is a
 * demonstration, and it is the only honest way to charge for something whose
 * diagnosis is free.
 *
 * There is no blur, no gradient over text, and no `user-select: none`. The fade
 * at the bottom is over the container's own background and stops before the
 * last visible line.
 */

import { previewOf, type FixFile, type PunchItem } from '@botready/core';

import { PRICING } from '@/lib/site';
import { buttonClass } from './primitives';

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
  /** The generated llms.txt, or whichever file has the most to show. */
  preview: FixFile;
  punchList: PunchItem[];
  fileCount: number;
  /** True when this reader has already bought it. */
  owned?: boolean;
}) {
  const { text, truncated } = previewOf(preview, 9);
  const quickWins = punchList.filter((item) => item.effort === 'minutes');
  const quickPoints = quickWins.reduce((sum, item) => sum + item.pointsRecovered, 0);

  return (
    <section className="mt-9 overflow-hidden rounded-[6px] border-[1.5px] border-ink">
      <div className="flex flex-col gap-6 px-[26px] py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[21px] font-bold">
            {owned ? 'Your fix pack is ready' : 'Get the files, not just the verdict'}
          </h2>
          <p className="mt-1.5 max-w-[56ch] text-[14px] text-ink-60">
            {owned ? (
              <>
                {fileCount} generated {fileCount === 1 ? 'file' : 'files'} and a punch list, built
                from this scan of {domain}.
              </>
            ) : (
              <>
                A generated llms.txt built from your real pages, the corrected robots.txt block
                naming the agents currently refused, the link tags for your top 20 URLs, and a
                JSON-LD block filled in from your own data.
                {quickWins.length > 0 ? (
                  <>
                    {' '}
                    {quickWins.length} of the {punchList.length}{' '}
                    {punchList.length === 1 ? 'item' : 'items'}{' '}
                    {quickWins.length === 1 ? 'is' : 'are'} minutes of work, worth {quickPoints}{' '}
                    {quickPoints === 1 ? 'point' : 'points'}.
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>

        <div className="shrink-0 sm:text-right">
          {owned ? null : (
            <p
              className="font-display text-[38px] font-extrabold leading-none"
              style={{ fontVariationSettings: "'wdth' 118" }}
            >
              {PRICING.fixpack.label}
              <span className="mt-1 block font-data text-[12px] font-normal tracking-[0.04em] text-ink-60">
                {PRICING.fixpack.cadence}
              </span>
            </p>
          )}
          <a
            href={owned ? `/api/fixpack/${scanId}` : `/api/checkout/${scanId}`}
            className={buttonClass('solid', 'md', 'mt-3')}
            {...(owned ? { download: `botready-fixpack-${domain}.zip` } : {})}
          >
            {owned ? 'Download the fix pack' : 'Get the fix pack'}
          </a>
        </div>
      </div>

      <figure className="relative m-0 border-t border-ink bg-card px-[26px] py-5">
        <figcaption className="mb-2.5 font-data text-micro uppercase tracking-[0.1em] text-ink-60">
          {preview.name} · generated for {domain}
          {truncated ? ' · cut off' : ''}
        </figcaption>
        <pre className="m-0 overflow-x-auto font-data text-[12px] whitespace-pre-wrap text-ink-60">
          {text}
        </pre>
        {truncated ? (
          <>
            {/* Over the container's own background, and only under the text, so
                nothing legible is obscured and nothing is blurred. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[88px] bg-gradient-to-b from-transparent to-card"
            />
            <p className="relative mt-3 font-data text-micro text-ink-60">
              {preview.content.split('\n').length - 9} more lines, and{' '}
              {fileCount - 1} more {fileCount - 1 === 1 ? 'file' : 'files'}, in the pack.
            </p>
          </>
        ) : null}
      </figure>
    </section>
  );
}
