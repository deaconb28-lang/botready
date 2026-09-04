import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { NewScanForm } from '@/components/app/NewScanForm';
import { propertyFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New scan', robots: { index: false, follow: false } };

export default async function NewScanPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/new`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();

  return (
    <div className="max-w-[580px]">
      <h1 className="display-tight text-[36px]">New scan</h1>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">One visit, six pages at most, about thirty seconds. Any page on {p.domain}, or another domain you want to add.</p>
      <NewScanForm mode="property" domain={p.domain} />
    </div>
  );
}
