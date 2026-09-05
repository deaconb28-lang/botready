import type { ReactNode } from 'react';
import Link from 'next/link';

import { Wordmark, cx } from '@/components/ui';
import type { Property } from '@/lib/app-data';
import { PRICING } from '@/lib/site';

import { AppSidebar, type NavItem } from './AppSidebar';

/**
 * The product shell: a white header with the property pills, a fixed 272px
 * sidebar with the property card, two nav groups and the promo card, and the
 * view on the lavender canvas. Under 900px the sidebar becomes a drawer.
 */
export function AppShell({
  property,
  properties,
  email,
  owned,
  children,
}: {
  property: Property | null;
  properties: Array<{ siteId: string; domain: string }>;
  email: string;
  owned: boolean;
  children: ReactNode;
}) {
  const nav = property ? navFor(property) : [];
  const fileCount = property?.pack ? property.pack.files.length + 2 : 0;
  const packHref = property?.scanId ? (owned ? `/api/fixpack/${property.scanId}` : `/api/checkout/${property.scanId}`) : '/pricing';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-50 border-b-2 border-ink bg-white">
        <div className="flex items-center gap-[14px] px-4 py-3 sm:px-[22px]">
          <Wordmark size={20} markSize={30} href="/app" />
          <nav aria-label="Properties" className="ml-2 hidden gap-2 sm:flex">
            {properties.map((p) => (
              <Link
                key={p.siteId}
                href={`/app/${p.domain}`}
                aria-current={property?.domain === p.domain ? 'page' : undefined}
                className={cx(
                  'edge whitespace-nowrap rounded-full px-4 py-[7px] font-body text-[13.5px] text-ink no-underline',
                  property?.domain === p.domain ? 'bg-lime font-bold' : 'bg-white font-medium hover:bg-lime-tint',
                )}
              >
                {p.domain}
              </Link>
            ))}
            <Link
              href="/app/new"
              className="edge whitespace-nowrap rounded-full bg-white px-4 py-[7px] font-body text-[13.5px] font-medium text-ink no-underline hover:bg-lime-tint"
            >
              + Add
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden whitespace-nowrap font-mono text-[13px] text-quiet lg:inline">signed in · {property?.domain ?? email}</span>
            {/* The one thing being sold, on every view rather than only on the
                two that happen to carry a card for it. A plain anchor: the
                unbought href is a checkout route that redirects to Stripe, and
                a client-side navigation cannot follow that. */}
            {property?.scanId ? (
              <a
                href={packHref}
                className="edge whitespace-nowrap rounded-[10px] bg-lime px-[14px] py-[7px] font-body text-[13.5px] font-bold text-ink no-underline shadow-hard-2 hover:bg-white"
              >
                {owned ? 'Download the pack' : `Get the pack — ${PRICING.fixpack.label}`}
              </a>
            ) : null}
            <Link href="/account" className="whitespace-nowrap font-body text-[13.5px] font-medium text-muted no-underline hover:text-ink">
              Account
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        <AppSidebar
          property={
            property
              ? {
                  domain: property.domain,
                  grade: property.score?.grade ?? null,
                  total: property.score?.total ?? null,
                  run: property.runNumber,
                  status: property.status,
                }
              : null
          }
          nav={nav}
          promo={{
            title: property?.projected && property.score && property.projected.total > property.score.total
              ? `${property.findings.filter((f) => f.remedy).length || 'A few'} file drops get you to ${article(property.projected.grade)} ${property.projected.grade}`
              : 'The fix pack, generated from your own pages',
            body: fileCount > 0 ? `${fileCount} generated files. Diagnosis stays free.` : 'Run a scan and the files are generated from it.',
            cta: owned ? 'Download the pack' : `Get the pack — ${PRICING.fixpack.label}`,
            href: packHref,
          }}
        />
        <main id="main" className="min-w-0 flex-1 px-5 pb-14 pt-6 sm:px-[30px] sm:pt-7">
          {children}
        </main>
      </div>
    </div>
  );
}

function article(grade: string): string {
  return /^[AF]/.test(grade) ? 'an' : 'a';
}

function navFor(p: Property): NavItem[] {
  const base = `/app/${p.domain}`;
  const worstPath = pathOf(p);
  return [
    { group: 'Diagnose', label: 'Overview', href: base, meta: p.score?.grade ?? '', tone: p.score && !/^[AB]/.test(p.score.grade) ? 'bad' : 'neutral' },
    { group: 'Diagnose', label: 'All issues', href: `${base}/issues`, meta: String(p.findings.length), tone: 'neutral' },
    { group: 'Diagnose', label: 'Page detail', href: `${base}/page`, meta: worstPath, tone: 'neutral' },
    { group: 'Diagnose', label: 'Competitors', href: `${base}/competitors`, meta: '', tone: 'neutral' },
    { group: 'Fix & watch', label: 'Editor', href: `${base}/editor`, meta: p.projected?.grade ?? '', tone: 'neutral' },
    { group: 'Fix & watch', label: 'Prompt watch', href: `${base}/watch`, meta: '', tone: 'neutral' },
    { group: 'Fix & watch', label: 'Settings', href: `${base}/settings`, meta: '', tone: 'neutral' },
    { group: 'Fix & watch', label: 'New scan', href: `${base}/new`, meta: '', tone: 'neutral' },
  ];
}

function pathOf(p: Property): string {
  const scanUrl = p.results.find((r) => r.key === 'title_meta_distinct')?.observed.pages;
  const first = Array.isArray(scanUrl) ? (scanUrl[0] as { url?: string } | undefined)?.url : undefined;
  try {
    return first ? new URL(first).pathname || '/' : '/';
  } catch {
    return '/';
  }
}
