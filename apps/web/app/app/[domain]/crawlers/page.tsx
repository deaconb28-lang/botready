import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { CrawlersLocked, CrawlersPanel } from '@/components/app/CrawlersPanel';
import { planFor } from '@/lib/account-data';
import { propertyFor, requireUser } from '@/lib/app-context';
import { loadCrawlers } from '@/lib/crawler-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Crawlers', robots: { index: false, follow: false } };

export default async function CrawlersPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/crawlers`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();

  const plan = await planFor(user.id);
  // Only queried for the plan that can read it, so the page costs nothing
  // extra for everybody else.
  const view = plan.limits.visibility ? await loadCrawlers(p.siteId) : null;

  return (
    <div>
      <h1 className="display-tight text-[36px]">Crawlers</h1>
      <p className="mb-[22px] mt-[10px] max-w-[70ch] text-[16px] leading-[1.55] text-body">
        Every scan asks what a crawler <em>would</em> get from {domain}. This is the other direction: which ones
        actually turned up, and which of them were really who they said they were.
      </p>
      {view ? <CrawlersPanel v={view} /> : <CrawlersLocked domain={domain} />}
    </div>
  );
}
