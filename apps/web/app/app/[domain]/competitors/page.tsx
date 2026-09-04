import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { CompetitorsView } from '@/components/app/CompetitorsView';
import { loadCompetitors } from '@/lib/app-data';
import { propertyFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Competitors', robots: { index: false, follow: false } };

export default async function CompetitorsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/competitors`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();
  const rows = await loadCompetitors(p.siteId, p.domain, p.results, p.score);
  const others = rows.filter((r) => !r.self).length;

  return (
    <div>
      <h1 className="display-tight text-[36px]">Competitors</h1>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        {others === 0
          ? 'Add the sites that come up when an assistant is asked about your category. Each one is scanned the same way and ranked beside you.'
          : `The ${wordNumber(others)} ${others === 1 ? 'site' : 'sites'} you track, ranked by the same scan you get, with how often the watched prompts cite each one.`}
      </p>
      <CompetitorsView siteId={p.siteId} rows={rows} />
    </div>
  );
}

function wordNumber(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n);
}
