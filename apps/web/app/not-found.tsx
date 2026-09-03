import Link from 'next/link';

import { Footer, Measure, Nav, Shell } from '@/components/primitives';
import { ScanForm } from '@/components/ScanForm';

export default function NotFound() {
  return (
    <Shell>
      <Nav />
      <Measure as="main" className="pb-14 pt-10">
        <p id="main" className="label text-fail">
          HTTP/1.1 404 Not Found
        </p>
        <h1 className="display-hero mt-4 max-w-[18ch] text-[40px] sm:text-[60px]">There is nothing at this URL.</h1>
        <p className="mt-5 max-w-[56ch] text-[16px] text-ink-60">
          If you followed a link to a scan, the id was wrong or the scan was never created. Run a new
          check, or start from{' '}
          <Link href="/index/saas" className="underline">
            the index
          </Link>
          .
        </p>
        <div className="max-w-[560px]">
          <ScanForm />
        </div>
      </Measure>
      <Footer />
    </Shell>
  );
}
