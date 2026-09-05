import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ResultsView, UnscoredView } from '@/components/results/ResultsView';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { currentUser, hasFixpackFor, ownsAnyFixpack } from '@/lib/auth';
import { standingFor } from '@/lib/chart-data';
import { loadScanView } from '@/lib/scan-data';
import { absoluteUrl } from '@/lib/site';
import { relativeTime } from '@/lib/theme';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const view = await loadScanView(id);
  if (!view) return { title: 'Scan not found' };

  const { site, score, scan } = view;
  const headline = score
    ? `${site.domain} scores ${score.total} out of 100 for agent readability`
    : scan.status === 'blocked'
      ? `${site.domain} refuses our scanner`
      : `${site.domain} is being checked`;

  return {
    title: score ? `${site.domain} · grade ${score.grade}` : site.domain,
    description: headline,
    openGraph: {
      title: headline,
      description: 'Measured by requesting the same URL as five different clients.',
      images: [{ url: absoluteUrl(`/api/og/${id}`), width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical: absoluteUrl(`/scan/${id}`) },
  };
}

export default async function ScanPage({ params }: PageProps) {
  const { id } = await params;
  const view = await loadScanView(id);
  if (!view) notFound();

  const { scan, site, results, score } = view;

  // Still working. The live page is the one that holds attention for thirty
  // seconds, so send them there rather than showing an empty result.
  if (scan.status === 'queued' || scan.status === 'running') {
    redirect(`/scan/live?id=${id}`);
  }

  const checkedLabel = `scanned ${relativeTime(scan.finished_at ?? scan.created_at)}`;
  const user = await currentUser();
  const owned = user ? await hasFixpackFor(user.id, view.site.domain) : false;
  // Owns a pack, but not this one: the button offers to add this domain at the
  // repeat price, and says which price before the click.
  const repeat = Boolean(user) && !owned && (user ? await ownsAnyFixpack(user.id) : false);
  // Where this lands against everything else measured. Best effort: a chart
  // that will not answer is not a reason to fail a result page.
  const standing = await standingFor(view.score?.total ?? null).catch(() => null);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        {score ? (
          <ResultsView
            scanId={id}
            domain={site.domain}
            url={scan.url}
            checkedLabel={checkedLabel}
            score={score}
            results={results}
            findings={view.findings}
            pagesCrawled={scan.pages_crawled}
            scannerVersion={scan.scanner_version}
            owned={owned}
            repeat={repeat}
            standing={standing}
          />
        ) : (
          <UnscoredView domain={site.domain} url={scan.url} checkedLabel={checkedLabel} status={scan.status} message={scan.error_message} results={results} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
