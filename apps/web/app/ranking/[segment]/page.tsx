import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Copy } from '@/components/ModeText';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, cx } from '@/components/ui';
import { loadIndex, type IndexRow } from '@/lib/index-data';
import { SEGMENTS, isSegment, type SegmentKey } from '@/lib/site';
import { scoreColorFor } from '@/lib/theme';

/**
 * Served at /index/[segment]. The directory is named `ranking` because a
 * segment called `index` trips Next's index.html handling and breaks the
 * Vercel deploy; next.config.ts carries the rewrite and the redirect.
 *
 * Static and re-generated hourly. The nightly cron writes the rows this reads.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SEGMENTS.map((s) => ({ segment: s.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params;
  const label = SEGMENTS.find((s) => s.key === segment)?.label ?? segment;
  return {
    title: `Who agents can read · ${label}`,
    description: `${label} sites, re-checked every night and ranked by how readable they are to the clients that answer questions about them.`,
    alternates: { canonical: `/index/${segment}` },
  };
}

export default async function IndexPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();

  const view = await loadIndex(segment).catch(() => null);
  const label = SEGMENTS.find((s) => s.key === segment)?.label ?? segment;

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={1080} className="pb-24 pt-14">
        <div className="text-center">
          <span className="eyebrow text-subtle-2">Public index · {label}</span>
          <h1 className="display-tight mt-3 text-[clamp(38px,5.2vw,64px)]">Who agents can read</h1>
          <p className="mx-auto mt-4 max-w-[54ch] text-[17px] leading-[1.6] text-muted">
            <Copy k="indexLede" />
          </p>
        </div>

        <nav aria-label="Segments" className="mt-8 flex flex-wrap justify-center gap-2">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key}
              href={`/index/${s.key}`}
              aria-current={s.key === segment ? 'page' : undefined}
              className={cx(
                'edge rounded-full px-[15px] py-[7px] font-body text-[13.5px] text-ink no-underline',
                s.key === segment ? 'bg-lime font-bold' : 'bg-white font-medium hover:bg-lime-tint',
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <Card radius="panel" shadow={4} className="mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <caption className="sr-only">{label} sites ranked by agent readability</caption>
              <thead>
                <tr className="border-b border-hairline font-mono text-[11px] font-medium tracking-[0.1em] text-placeholder">
                  <Th className="w-[44px]">#</Th>
                  <Th>DOMAIN</Th>
                  <Th align="right" className="w-[80px]">
                    SCORE
                  </Th>
                  <Th align="right" className="w-[110px]">
                    AGENTS OK
                  </Th>
                  <Th align="right" className="w-[92px]">
                    CHANGE
                  </Th>
                </tr>
              </thead>
              <tbody>
                {view && view.rows.length > 0 ? (
                  view.rows.map((row) => <IndexTableRow key={row.siteId} row={row} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[15px] text-muted">
                      {view ? `No ${label} sites have been scanned yet.` : 'The index could not be read. Try again in a minute.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-4 text-center font-mono text-[12.5px] text-placeholder">
          Every row links to a result page anyone can read.
          {view?.scoringVersion ? ` Scoring v${view.scoringVersion}.` : ''}
        </p>
      </Container>
      <SiteFooter />
    </div>
  );
}

function Th({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th scope="col" className={cx('px-3 py-[14px] font-medium first:pl-6 last:pr-6', align === 'right' ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  );
}

function IndexTableRow({ row }: { row: IndexRow }) {
  const change = row.total !== null && row.previousTotal !== null ? row.total - row.previousTotal : null;
  const changeText = change === null ? (row.total !== null ? 'new' : '') : change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : '0';
  const changeColor = change === null ? '#A0A7AE' : change > 0 ? '#3F8F1E' : change < 0 ? '#B23C1F' : '#A0A7AE';
  return (
    <tr className="border-b border-hairline-2 hover:bg-paper">
      <td className="py-[15px] pl-6 pr-3 font-mono text-[12.5px] text-placeholder">{String(row.rank).padStart(2, '0')}</td>
      <td className="px-3 py-[15px] font-body text-[15.5px] font-semibold">
        <Link href={`/r/${row.domain}`} className="text-ink no-underline hover:underline">
          {row.domain}
        </Link>
      </td>
      <td className="px-3 py-[15px] text-right font-mono text-[15px] font-medium" style={{ color: row.total === null ? '#B23C1F' : scoreColorFor(row.total) }}>
        {row.total === null ? 'blocked' : row.total}
      </td>
      <td className="px-3 py-[15px] text-right font-mono text-[12.5px] text-subtle-2">
        {row.refused ? `${row.refused.of - row.refused.count} of ${row.refused.of}` : '—'}
      </td>
      <td className="py-[15px] pl-3 pr-6 text-right font-mono text-[12.5px] font-medium" style={{ color: changeColor }}>
        {changeText}
      </td>
    </tr>
  );
}

export type { SegmentKey };
