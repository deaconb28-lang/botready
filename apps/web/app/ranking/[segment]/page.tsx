import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ButtonLink, Footer, Measure, Microcopy, Nav, Shell, StatusLine } from '@/components/primitives';
import { loadIndex, type IndexRow } from '@/lib/index-data';
import { SEGMENTS, isSegment, type SegmentKey } from '@/lib/site';

/**
 * Static and re-generated hourly. The nightly cron writes the rows this reads;
 * regenerating on a timer rather than on demand is what lets a link to this
 * page from anywhere cost nothing to serve.
 *
 * Full-width rows and no card chrome: a ranking is a list, and the confident
 * version of a list is the list.
 *
 * Served at /index/[segment]. The directory is named `ranking` because a
 * segment called `index` trips Next's index.html handling and breaks the
 * Vercel deploy; next.config.ts carries the rewrite and the redirect.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SEGMENTS.map((s) => ({ segment: s.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
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
    <Shell>
      <Nav action={<ButtonLink href="/" size="sm">Check your site</ButtonLink>} />

      <Measure as="main" wide className="pb-14 pt-6">
        <p id="main" className="label text-fail">
          The agent readability index
        </p>
        <h1 className="display-hero mt-3 text-[40px] sm:text-[60px]">{label}</h1>
        <p className="mt-4 max-w-[60ch] text-[16px] text-ink-60">
          {view ? `${view.rows.length} sites` : 'Sites'}, re-checked every night
          {view?.scoringVersion ? ` with scoring v${view.scoringVersion}` : ''}.{' '}
          <Link href="/what-we-check" className="underline">
            Weights are published
          </Link>
          . Argue with them.
        </p>

        <nav aria-label="Segments" className="mono mt-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-ink pb-3 text-[12.5px]">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key}
              href={`/index/${s.key}`}
              aria-current={s.key === segment ? 'page' : undefined}
              className={s.key === segment ? 'font-bold text-ink' : 'text-ink-60 hover:text-ink'}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {!view || view.rows.length === 0 ? <EmptyIndex label={label} /> : <IndexTable rows={view.rows} segment={segment} />}

        {view ? (
          <Microcopy className="mt-5">
            Blocked our scanner: {view.blocked} {view.blocked === 1 ? 'site' : 'sites'}. We list them as
            blocked and do not work around it.
            {view.lastCheckedAt ? ` Last check ${formatDate(view.lastCheckedAt)}.` : ''}
          </Microcopy>
        ) : null}
      </Measure>

      <Footer />
    </Shell>
  );
}

function IndexTable({ rows, segment }: { rows: IndexRow[]; segment: SegmentKey }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={`${segment} rankings`}>
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="label text-ink-60">
            <Th className="w-[48px]">#</Th>
            <Th>Site</Th>
            <Th className="w-[72px]">Grade</Th>
            <Th align="right">Score</Th>
            <Th align="right">Refused</Th>
            <Th align="right">JS dep.</Th>
            <Th align="right">Status</Th>
            <Th>
              <span className="sr-only">Claim</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.siteId} className="border-b border-rule">
              <td className="mono py-3.5 pr-3 text-[13px] text-ink-60">{row.rank}</td>
              <td className="py-3.5 pr-3 text-[15px] font-semibold">
                <Link href={`/scan/${row.scanId}`} className="hover:underline">
                  {row.domain}
                </Link>
              </td>
              <td className="py-3.5 pr-3">
                {row.grade ? (
                  <span className={`display-section text-[22px] ${gradeColour(row.grade)}`}>{row.grade}</span>
                ) : (
                  <span className="mono text-[12px] text-ink-60">—</span>
                )}
              </td>
              <Td align="right">{row.total ?? '—'}</Td>
              <Td align="right">{row.refused ? `${row.refused.count} of ${row.refused.of}` : '—'}</Td>
              <Td align="right">{row.jsRatio !== null ? row.jsRatio.toFixed(2) : '—'}</Td>
              <td className="mono py-3.5 pr-3 text-right text-[12.5px]">
                <StatusLine status={row.status === 'blocked' ? 403 : 200} />
              </td>
              <td className="py-3.5 text-right text-[12.5px]">
                {row.isClaimed ? (
                  <span className="text-ink-60">Claimed</span>
                ) : (
                  <Link href={`/claim/${row.domain}`} className="text-ink-60 underline hover:text-ink">
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
    <div className="border-b border-rule py-10">
      <p className="text-[17px] font-semibold">No {label} sites have been checked yet.</p>
      <p className="mt-2 max-w-[60ch] text-[14.5px] text-ink-60">
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

function Th({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th scope="col" className={`pb-2.5 pr-3 pt-4 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`mono py-3.5 pr-3 text-[13px] ${align === 'right' ? 'text-right' : ''}`}>{children}</td>;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
