import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Container } from '@/components/ui';
import { PUBLIC_INDEX_LISTED } from '@/lib/site';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={760} className="pb-24 pt-14">
        <span className="eyebrow text-subtle-2">HTTP 404</span>
        <h1 className="display-tight mt-3 text-[clamp(38px,6vw,68px)]">Nothing at this address.</h1>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-muted">
          The page you asked for does not exist, or the scan it pointed at has gone. A result page keeps its address, so if you had a link to one, it was never here.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/" tone="ink" size="lg" shadow={3}>
            Run a check
          </Button>
          {PUBLIC_INDEX_LISTED ? (
            <Button href="/index/saas" tone="white" size="lg">
              Browse the index
            </Button>
          ) : (
            <Button href="/what-we-check" tone="white" size="lg">
              See what we check
            </Button>
          )}
        </div>
        <p className="mt-6 font-mono text-[12.5px] text-subtle-2">
          Looking for the crawler docs? <Link href="/bot">/bot</Link>.
        </p>
      </Container>
      <SiteFooter />
    </div>
  );
}
