import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { Chip, cx } from '@/components/ui';
import { pageDetail } from '@/lib/app-data';
import { propertyFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page detail', robots: { index: false, follow: false } };

export default async function PageDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/page`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();

  const target = p.results.find((r) => r.key === 'title_meta_distinct')?.observed.pages;
  const url = Array.isArray(target) && target[0] && typeof (target[0] as { url?: unknown }).url === 'string' ? (target[0] as { url: string }).url : `https://${p.domain}/`;
  const detail = p.score ? pageDetail(url, p.results) : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="display-tight text-[36px]">Page detail</h1>
        <span className="font-mono text-[14.5px] font-medium text-quiet">
          {p.domain}
          {detail?.path ?? '/'}
        </span>
      </div>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        {detail ? 'The page we rendered, and what arrived before any JavaScript ran. Agents read the first one.' : 'Run a scan and the raw response is shown beside the rendered result.'}
      </p>

      {detail ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            <Panel title="What arrived in the raw response" tone="coral" excerpt={detail.rawExcerpt} chars={detail.rawChars} />
            <Panel title="What a browser ends up with" tone="lime" excerpt={detail.renderedExcerpt} chars={detail.renderedChars} />
          </div>
          <div className="edge mt-4 overflow-hidden rounded-[14px] bg-white shadow-hard-3">
            {detail.rows.map((row, i) => (
              <div key={row.label} className={cx('flex items-center gap-[14px] px-5 py-[15px]', i < detail.rows.length - 1 && 'border-b-2 border-rule')}>
                <span className="min-w-0 flex-1 font-body text-[15px] font-semibold">{row.label}</span>
                <span className="hidden font-mono text-[13px] text-quiet sm:inline">{row.value}</span>
                <Chip tone={row.ok ? 'ok' : 'bad'}>{row.chip}</Chip>
              </div>
            ))}
          </div>
          {!detail.rawExcerpt ? (
            <p className="mt-4 font-mono text-[12.5px] text-subtle">This scan ran on scanner 1.0.0, which kept the character counts but not the text. The next scan records an excerpt of each side.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Panel({ title, tone, excerpt, chars }: { title: string; tone: 'coral' | 'lime'; excerpt: string | null; chars: number }) {
  return (
    <div className="edge overflow-hidden rounded-[14px] bg-white shadow-hard-3">
      <div className={cx('border-b-2 border-ink px-[18px] py-3 font-mono text-[12.5px] font-bold tracking-[0.06em] uppercase', tone === 'coral' ? 'bg-coral' : 'bg-lime')}>{title}</div>
      <pre className="overflow-auto whitespace-pre-wrap p-5 font-mono text-[12.5px] leading-[1.8] text-body">
        {excerpt ? `${excerpt}\n\n` : chars === 0 ? '(nothing readable)\n\n' : ''}readable characters: {chars.toLocaleString('en-US')}
      </pre>
    </div>
  );
}
