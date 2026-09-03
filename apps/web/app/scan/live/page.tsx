import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Footer, Nav } from '@/components/primitives';
import { LiveScan } from './LiveScan';

export const metadata: Metadata = {
  title: 'Running the check',
  // In progress and never worth indexing: the URL is transient and the result
  // page is the one that should travel.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LiveScanPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect('/');

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />
      <main id="main">
        <LiveScan scanId={id} />
      </main>
      <Footer />
    </div>
  );
}
