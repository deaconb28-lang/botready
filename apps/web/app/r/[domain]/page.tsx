import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { normaliseDomain } from '@botready/core';

import { HeroScanCard } from '@/components/home/HeroScanCard';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Container } from '@/components/ui';
import { latestScanForDomain } from '@/lib/scan-data';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * /r/:domain — the result for a domain, by name.
 *
 * The canonical result lives at /scan/:id, because a scan is a fact with a
 * date on it and a domain is a moving target. This page finds the domain's
 * most recent finished scan and renders that page in place; it does not
 * redirect, so the short URL survives being pasted.
 */
export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain: raw } = await params;
  const domain = safeDomain(raw);
  return {
    title: domain ? `${domain} · agent readability` : 'Result',
    alternates: domain ? { canonical: absoluteUrl(`/r/${domain}`) } : undefined,
  };
}

export default async function DomainResultPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = safeDomain(raw);
  if (!domain) notFound();

  const scan = await latestScanForDomain(domain);
  if (scan) {
    // Render the scan page's exact component tree for the latest scan.
    const { default: ScanPage } = await import('@/app/scan/[id]/page');
    return ScanPage({ params: Promise.resolve({ id: scan.id }) });
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={760} className="pb-24 pt-14 text-center">
        <span className="eyebrow text-subtle-2">Not scanned yet</span>
        <h1 className="display-tight mt-3 break-all text-[clamp(34px,5vw,56px)]">{domain}</h1>
        <p className="mx-auto mt-4 max-w-[50ch] text-[17px] leading-[1.6] text-muted">
          We have not checked this domain. Run it now: free, no account, about thirty seconds, and the result is a page you can link to.
        </p>
        <div className="mt-8">
          <HeroScanCard compact />
        </div>
        <p className="mt-6 font-mono text-[12.5px] text-subtle-2">
          Or browse <Link href="/index/saas">the public index</Link>.
        </p>
      </Container>
      <SiteFooter />
    </div>
  );
}

function safeDomain(raw: string): string | null {
  try {
    const domain = normaliseDomain(decodeURIComponent(raw));
    return domain.includes('.') ? domain : null;
  } catch {
    return null;
  }
}
