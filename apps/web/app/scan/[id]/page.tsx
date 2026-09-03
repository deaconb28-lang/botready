import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CompleteResult, UnscoredResult, formatUtc } from '@/components/ScanResult';
import { ButtonLink, Footer, Nav } from '@/components/primitives';
import { currentUser, hasFixpackEntitlement } from '@/lib/auth';
import { loadScanView } from '@/lib/scan-data';
import { absoluteUrl } from '@/lib/site';

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

  const checkedAt = formatUtc(scan.finished_at ?? scan.created_at);

  const user = await currentUser();
  const owned = user ? await hasFixpackEntitlement(user.id) : false;

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav
        action={
          <ButtonLink href="/" size="sm">
            Check another site
          </ButtonLink>
        }
      />

      <main id="main" className="px-5 pb-14 pt-8 sm:px-7">
        {score ? (
          <CompleteResult
            id={id}
            domain={site.domain}
            url={scan.url}
            checkedAt={checkedAt}
            score={score}
            results={results}
            findings={view.findings}
            passing={view.passing}
            pagesCrawled={scan.pages_crawled}
            scannerVersion={scan.scanner_version}
            owned={owned}
          />
        ) : (
          <UnscoredResult
            domain={site.domain}
            url={scan.url}
            checkedAt={checkedAt}
            status={scan.status}
            message={scan.error_message}
            results={results}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

