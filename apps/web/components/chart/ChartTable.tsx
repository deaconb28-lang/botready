import Link from 'next/link';

import type { ChartRow } from '@/lib/chart-data';
import { SiteFavicon } from '@/components/results/SiteFavicon';
import { cx } from '@/components/ui';

/**
 * The chart, in the shape a chart has always had.
 *
 * Rank on the left in a box, the thing itself with its picture and its own
 * words in the middle, and the numbers that give a row its history on the
 * right: last week, peak, weeks on. Borrowed knowingly — a hundred years of
 * people reading charts is a lot of design research to ignore.
 *
 * What is ours is the grade. A chart of songs has no notion of a song being
 * wrong; every row here is a site that either can or cannot be read, so the
 * grade sits where the chart position would normally be enough on its own.
 *
 * Number one gets the lime box. Everything else is white, because a chart
 * where every row shouts is a list.
 */
export function ChartTable({ rows }: { rows: ChartRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="edge rounded-[18px] bg-white p-[26px]">
        <h2 className="display text-[19px]">Nothing on the chart yet</h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-muted">
          Every site anyone checks joins it. Run the first one.
        </p>
      </div>
    );
  }

  return (
    <ol className="m-0 grid list-none gap-[10px] p-0">
      {rows.map((row) => (
        <ChartEntry key={row.siteId} row={row} />
      ))}
    </ol>
  );
}

function ChartEntry({ row }: { row: ChartRow }) {
  const top = row.rank === 1;

  return (
    <li>
      <Link
        href={`/r/${row.domain}`}
        className="edge lift grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-x-[14px] rounded-[16px] bg-white px-[14px] py-[12px] no-underline shadow-hard-3 sm:grid-cols-[64px_28px_minmax(0,1fr)_auto] sm:gap-x-[16px] sm:px-[18px]"
      >
        {/* The rank, boxed. Lime at number one and nowhere else. */}
        <span
          className={cx(
            'edge grid h-[52px] place-items-center rounded-[12px] display text-[26px] tabular-nums text-ink sm:h-[62px] sm:text-[32px]',
            top ? 'bg-lime' : 'bg-canvas',
          )}
        >
          {row.rank}
        </span>

        {/* Which way it moved. Its own column on a wide screen so the arrows
            line up down the page and the shape of the week is readable at a
            glance; folded in beside the name on a phone. */}
        <span className="hidden justify-self-center sm:block">
          <Movement row={row} />
        </span>

        <span className="flex min-w-0 items-center gap-[12px]">
          <SiteFavicon candidates={row.iconCandidates} domain={row.domain} size={38} className="hidden sm:flex" />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="sm:hidden">
                <Movement row={row} />
              </span>
              <span className="display block truncate text-[15.5px] font-semibold text-ink">{row.domain}</span>
              {row.isClaimed ? (
                <span className="hidden shrink-0 rounded-[6px] bg-violet-chip px-[6px] py-[1px] font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-violet sm:inline">
                  Claimed
                </span>
              ) : null}
            </span>
            <span className="mt-[2px] block truncate text-[13px] leading-[1.4] text-muted">
              {row.status === 'blocked'
                ? 'Refused our crawler. Recorded as blocked.'
                : (row.description ?? 'No description on the homepage for a client to read.')}
            </span>
          </span>
        </span>

        <span className="flex items-center gap-[14px] sm:gap-[18px]">
          <Stats row={row} />
          <Grade row={row} />
        </span>
      </Link>
    </li>
  );
}

/** LW, PEAK, WEEKS. The three numbers that turn a list into a chart. */
function Stats({ row }: { row: ChartRow }) {
  return (
    <span className="hidden grid-cols-[auto_auto] gap-x-[10px] gap-y-[1px] font-mono text-[10.5px] leading-[1.35] md:grid">
      <span className="text-placeholder">LW</span>
      <span className="text-right tabular-nums text-ink">{row.prevRank ?? '—'}</span>
      <span className="text-placeholder">PEAK</span>
      <span className="text-right tabular-nums text-ink">{row.peakTotal ?? '—'}</span>
      <span className="text-placeholder">WEEKS</span>
      <span className="text-right tabular-nums text-ink">{row.weeksOn}</span>
    </span>
  );
}

function Grade({ row }: { row: ChartRow }) {
  if (row.status === 'blocked' || row.grade === null || row.total === null) {
    return (
      <span className="edge grid h-[46px] w-[46px] place-items-center rounded-[12px] bg-coral display text-[17px] text-ink sm:h-[52px] sm:w-[52px]">
        —
      </span>
    );
  }

  // Only an A is drawn as healthy, the same rule the result page follows. A B
  // is a site some clients still cannot read.
  const healthy = row.grade === 'A';
  return (
    <span className="flex items-center gap-[10px]">
      <span className="hidden text-right sm:block">
        <span className="display block text-[22px] leading-none tabular-nums text-ink">{row.total}</span>
        <span className="block font-mono text-[10px] text-placeholder">/ 100</span>
      </span>
      <span
        className={cx(
          'edge grid h-[46px] w-[46px] place-items-center rounded-[12px] display text-[20px] sm:h-[52px] sm:w-[52px] sm:text-[22px]',
          healthy ? 'bg-green text-white' : row.grade === 'B' ? 'bg-amber text-ink' : 'bg-coral text-ink',
        )}
      >
        {row.grade}
      </span>
    </span>
  );
}

/**
 * New, up, down or held.
 *
 * A new entry says so rather than showing a movement of zero, because a site
 * with no week behind it has not held anything.
 */
function Movement({ row }: { row: ChartRow }) {
  if (row.move === 'new') {
    return (
      <span className="edge inline-block rounded-[6px] bg-lime px-[6px] py-[1px] font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink">
        New
      </span>
    );
  }
  if (row.move === 'same') {
    return <span className="font-mono text-[13px] text-placeholder">=</span>;
  }
  const up = row.move === 'up';
  return (
    <span className={cx('font-mono text-[11px] font-bold', up ? 'text-green' : 'text-coral')}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="ml-[2px] tabular-nums">{row.moveBy}</span>
      <span className="sr-only">{up ? `up ${row.moveBy}` : `down ${row.moveBy}`} since last week</span>
    </span>
  );
}
