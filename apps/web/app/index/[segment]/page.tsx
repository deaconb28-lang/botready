import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ButtonLink, Footer, Microcopy, Nav, StatusPill } from '@/components/primitives';
import { loadIndex, type IndexRow } from '@/lib/index-data';
import { SEGMENTS, isSegment, type SegmentKey } from '@/lib/site';

/**
 * Static and re-generated hourly. The nightly cron writes the rows this reads;
 * regenerating on a timer rather than on demand is what lets a link to this
 * page from anywhere cost nothing to serve.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SEGMENTS.map((s) => ({ segment: s.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string }>;
}): Promise<Metadata> {
  const { segment } = await params;
  const label = SEGMENTS.find((s) => s.key === segment)?.label ?? segment;
  return {
    title: `The agent readability index · ${label}`,
    description: `${label} sites, re-checked every night. How legible each one is to the clients that read it to answer questions about it, with the weights published.`,
  };
}

export default async function IndexPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();

  const view = await loadIndex(segment).catch(() => null);
  const label = SEGMENTS.find((s) => s.key === segment)?.label ?? segment;

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav
        action={
          <ButtonLink href="/" size="sm">
            Check your site
          </ButtonLink>
        }
      />

      <main id="main" className="px-5 pb-14 pt-8 sm:px-7">
        <nav aria-label="Segments" className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key}
              href={`/index/${s.key}`}
              aria-current={s.key === segment ? 'page' : undefined}
              className={
                s.key === segment
                  ? 'border-b-2 border-ink pb-0.5 font-semibold'
                  : 'text-ink-60 hover:text-ink'
              }
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <h1
          className="font-display text-[26px] font-extrabold tracking-[-0.02em] sm:text-[30px]"
          style={{ fontVariationSettings: "'wdth' 118" }}
        >
          The agent readability index
        </h1>
        <p className="mt-2 mb-6 max-w-[62ch] text-[15px] text-ink-60">
          {view ? `${view.rows.length} ${label} sites` : `${label} sites`}, re-checked every night
          {view?.scoringVersion ? ` with scoring v${view.scoringVersion}` : ''}.{' '}
          <Link href="/what-we-check" className="underline">
            Weights are published
          </Link>
          . Argue with them.
        </p>

        {!view || view.rows.length === 0 ? (
          <EmptyIndex label={label} />
        ) : (
          <IndexTable rows={view.rows} segment={segment} />
        )}

        {view ? (
          <Microcopy className="mt-[18px]">
            Blocked our scanner: {view.blocked} {view.blocked === 1 ? 'site' : 'sites'}. We list
            them as blocked and do not work around it.
            {view.lastCheckedAt ? ` Last check ${formatDate(view.lastCheckedAt)}.` : ''}
          </Microcopy>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

function IndexTable({ rows, segment }: { rows: IndexRow[]; segment: SegmentKey }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={`${segment} rankings`}>
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <thead>
          <tr>
            <Th className="w-[42px]">#</Th>
            <Th>Site</Th>
            <Th>Grade</Th>
            <Th align="right">Score</Th>
            <Th align="right">Agents refused</Th>
            <Th align="right">JS dependency</Th>
            <Th>
              <span className="sr-only">Claim</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.siteId} className="border-b border-rule">
              <td className="py-3 pr-2.5 font-data text-[13px] text-ink-60">{row.rank}</td>
              <td className="py-3 pr-2.5 font-body text-[14.5px] font-semibold">
                <Link href={`/scan/${row.scanId}`} className="hover:underline">
                  {row.domain}
                </Link>
              </td>
              <td className="py-3 pr-2.5">
                {row.status === 'blocked' ? (
                  <StatusPill status={403} label="blocked" />
                ) : row.grade ? (
                  <span className={`font-data text-[15px] font-bold ${gradeColour(row.grade)}`}>
                    {row.grade}
                  </span>
                ) : (
                  <span className="font-data text-[12px] text-ink-60">unscored</span>
                )}
              </td>
              <Td align="right">{row.total ?? '—'}</Td>
              <Td align="right">
                {row.refused ? `${row.refused.count} of ${row.refused.of}` : '—'}
              </Td>
              <Td align="right">{row.jsRatio !== null ? row.jsRatio.toFixed(2) : '—'}</Td>
              <td className="py-3 text-right">
                {row.isClaimed ? (
                  <span className="font-body text-[12.5px] text-ink-60">Claimed</span>
                ) : (
                  <Link
                    href={`/claim/${row.domain}`}
                    className="font-body text-[12.5px] text-ink-60 underline hover:text-ink"
                  >
                    Claim this site
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyIndex({ label }: { label: string }) {
  return (
    <div className="rounded-[6px] border border-rule bg-card px-[22px] py-6">
      <p className="text-[15px] font-semibold">No {label} sites have been checked yet.</p>
      <p className="mt-1.5 max-w-[60ch] text-[14px] text-ink-60">
        The index fills in after the first nightly run. Every row will be a real scan, re-checked
        every night, and blocked sites will be listed as blocked rather than left out.
      </p>
    </div>
  );
}

function gradeColour(grade: string): string {
  if (grade === 'A' || grade === 'B') return 'text-pass';
  if (grade === 'C') return 'text-warn';
  return 'text-fail';
}

function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-ink pb-2.5 pr-2.5 font-data text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-60 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`py-3 pr-2.5 font-data text-[13px] ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
