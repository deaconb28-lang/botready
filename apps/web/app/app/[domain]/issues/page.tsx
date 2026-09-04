import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { FindingsList } from '@/components/results/FindingsList';
import { propertyFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'All issues', robots: { index: false, follow: false } };

export default async function IssuesPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/issues`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();

  // Ordered by effort: the punch list's order, then anything the punch list
  // has no remedy for, worst first.
  const order = new Map((p.pack?.punchList ?? []).map((item, i) => [item.key, i]));
  const sorted = [...p.findings].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999) || b.pointsLost - a.pointsLost);
  const observed = new Map(p.results.map((r) => [r.key, r.observed]));
  const missing = p.score ? 100 - p.score.total : 0;

  return (
    <div>
      <h1 className="display-tight text-[36px]">All issues</h1>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        {p.score
          ? sorted.length === 0
            ? 'Nothing failed. Every check in the catalog passed on the last scan.'
            : `${wordNumber(sorted.length)} ${sorted.length === 1 ? 'finding' : 'findings'}, ordered by effort. Together they are worth the ${missing} points you are missing.`
          : 'Run a scan and the findings appear here, ordered by effort.'}
      </p>
      <FindingsList items={sorted.map((finding) => ({ finding, observed: observed.get(finding.key) ?? {} }))} pointsMissing={missing} variant="app" />
    </div>
  );
}

function wordNumber(n: number): string {
  const w = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][n];
  return w ?? String(n);
}
