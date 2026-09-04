import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { ReportSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <ReportSkeleton />
      </main>
      <SiteFooter />
    </div>
  );
}
