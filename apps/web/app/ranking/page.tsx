import type { Metadata } from 'next';

import { ChartTable } from '@/components/chart/ChartTable';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Container } from '@/components/ui';
import { loadChart } from '@/lib/chart-data';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The chart',
  description: 'Every site we have checked, ranked by how much of it an AI client can actually read.',
  alternates: { canonical: absoluteUrl('/chart') },
};

/**
 * The chart, at /chart through a rewrite. next.config.ts has the two reasons
 * the directory cannot be called either of those things.
 *
 * Dynamic, and deliberately so. A site's score changes the moment it is
 * re-scanned, and a chart that is a build artefact is a chart that is wrong
 * between deploys. It is one indexed read of a view.
 */
export const dynamic = 'force-dynamic';

export default async function ChartPage() {
  const chart = await loadChart();
  const scored = chart.rows.filter((r) => r.status !== 'blocked').length;

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
          {chart.lastCheckedAt ? <span>updated {relative(chart.lastCheckedAt)}</span> : null}
        </div>

        <div className="mt-8">
          <ChartTable rows={chart.rows} />
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

/** "4 hours ago". Coarse on purpose: a chart is not a stopwatch. */
function relative(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
