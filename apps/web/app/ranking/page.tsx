import type { Metadata } from 'next';
import Link from 'next/link';

import { ChartTable } from '@/components/chart/ChartTable';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Container, cx } from '@/components/ui';
import {
  CHART_SORTS,
  DEFAULT_CHART_SORT,
  isChartSort,
  loadChart,
  since,
  sortChart,
  type ChartSort,
} from '@/lib/chart-data';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The chart',
  description: 'Every site we have checked, ranked by how much of it an AI client can actually read.',
  // Both orders are the same rows, so the canonical is the chart itself. A
  // second URL indexed for the same content would compete with it.
  alternates: { canonical: absoluteUrl('/chart') },
};

/**
 * The chart, at /chart through a rewrite. next.config.ts has the two reasons
 * the directory cannot be called either of those things.
 *
 * Dynamic, and deliberately so. A site's score changes the moment it is
 * re-scanned, and a chart that is a build artefact is a chart that is wrong
 * between deploys. It is one indexed read of a view.
 *
 * The order lives in the URL rather than in component state. Three reasons,
 * and the first is the one that matters here: a sort control that only works
 * once JavaScript has run would be an odd thing to ship on a site whose whole
 * argument is that a client which does not run JavaScript should still get the
 * page. It also makes an order linkable, and keeps the page server-rendered.
 */
export const dynamic = 'force-dynamic';

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: asked } = await searchParams;
  const sort: ChartSort = isChartSort(asked) ? asked : DEFAULT_CHART_SORT;

  const chart = await loadChart();
  // loadChart returns ranked sites only, so this is the whole list.
  const scored = chart.rows.length;
  const rows = sortChart(chart.rows, sort);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={1000} className="pb-24 pt-14">
        <span className="eyebrow text-subtle-2">The chart</span>
        <h1 className="display-tight mt-3 text-[clamp(34px,5vw,56px)]">Who AI clients can actually read</h1>
        <p className="mt-4 max-w-[54ch] text-[17px] leading-[1.6] text-muted">
          Every site anyone has checked, ranked. It moves when a site does.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12.5px] text-subtle-2">
          <span>
            <span className="text-ink">{scored}</span> ranked
          </span>
          {chart.blocked > 0 ? (
            <span>
              <span className="text-ink">{chart.blocked}</span> refused the crawler
            </span>
          ) : null}
          {chart.scoringVersion ? <span>scoring v{chart.scoringVersion}</span> : null}
          {chart.lastCheckedAt ? <span>updated {since(chart.lastCheckedAt)}</span> : null}
        </div>

        <SortControl sort={sort} />

        <div className="mt-6">
          <ChartTable rows={rows} sort={sort} />
        </div>

        <div className="edge mt-9 rounded-[18px] bg-violet p-[26px] text-white">
          <h2 className="display text-[22px] text-white">Not on it?</h2>
          <p className="mt-2 max-w-[46ch] text-[15px] leading-[1.55] text-on-violet">
            Every site anyone checks joins the chart. Check yours and find out where it lands.
          </p>
          <Button href="/#check" tone="lime" size="lg" shadow={4} weight={700} className="mt-5">
            Run the free check
          </Button>
        </div>
      </Container>
      <SiteFooter />
    </div>
  );
}

/**
 * Two links, not a select. Each order is a real URL somebody can send, the
 * page is server-rendered either way, and there is nothing here that needs a
 * script to work.
 *
 * The hint under it is the part that stops the second order being misread. In
 * recency order the top row is not number one, and saying so once is cheaper
 * than a reader working out why row one has a 40 in the box.
 */
function SortControl({ sort }: { sort: ChartSort }) {
  const current = CHART_SORTS.find((s) => s.key === sort);
  return (
    <nav className="mt-7" aria-label="Chart order">
      <div className="flex flex-wrap items-center gap-[9px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-placeholder">Order</span>
        {CHART_SORTS.map((option) => {
          const active = option.key === sort;
          return (
            <Link
              key={option.key}
              // The default order is the bare URL. A canonical view reachable
              // at two addresses is the thing sitemap and canonical checks
              // exist to complain about.
              href={option.key === DEFAULT_CHART_SORT ? '/chart' : `/chart?sort=${option.key}`}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={cx(
                'edge rounded-[99px] px-[13px] py-[5px] font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] no-underline',
                active ? 'bg-lime text-ink shadow-hard-2' : 'bg-white text-subtle-2 hover:text-ink',
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
      {current ? (
        <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.55] text-muted">{current.hint}</p>
      ) : null}
    </nav>
  );
}
