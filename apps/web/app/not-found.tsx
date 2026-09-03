import Link from 'next/link';

import { Footer, Nav } from '@/components/primitives';
import { ScanForm } from '@/components/ScanForm';

export default function NotFound() {
  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />
      <main id="main" className="px-5 pb-14 pt-14 sm:px-7">
        <p className="font-data text-[11px] uppercase tracking-[0.12em] text-fail">HTTP 404</p>
        <h1
          className="mt-3 max-w-[24ch] font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[44px]"
          style={{ fontVariationSettings: "'wdth' 110" }}
        >
          There is nothing at this URL.
        </h1>
        <p className="mt-4 max-w-[56ch] text-[16px] text-ink-60">
          If you followed a link to a scan, the id was wrong or the scan was never created. Run a
          new check, or start from{' '}
          <Link href="/index/saas" className="underline">
            the index
          </Link>
          .
        </p>
        <ScanForm />
      </main>
      <Footer />
    </div>
  );
}
