import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { LiveScan } from './LiveScan';

export const metadata: Metadata = {
  title: 'Running the check',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LiveScanPage({ searchParams }: { searchParams: Promise<{ id?: string; next?: string }> }) {
  const { id, next } = await searchParams;
  if (!id) redirect('/');

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <LiveScan scanId={id} next={next && next.startsWith('/') && !next.startsWith('//') ? next : null} />
      </main>
      <SiteFooter />
    </div>
  );
}
