import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Card, Container, TerminalLine } from '@/components/ui';
import { currentUser, hasFixpackEntitlement } from '@/lib/auth';
import { loadScanView } from '@/lib/scan-data';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Purchase complete',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends people after paying. The webhook that grants the
 * entitlement usually lands before the browser does, but not always, so this
 * page copes with both orders.
 */
export default async function PurchasedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadScanView(id);
  if (!view) notFound();

  const user = await currentUser();
  const entitled = user ? await hasFixpackEntitlement(user.id) : false;
  const domain = view.site.domain;

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={760} className="pb-24 pt-14">
        <span className="eyebrow text-subtle-2">Fix pack</span>
        <h1 className="display-tight mt-3 text-[clamp(34px,5vw,56px)]">{entitled ? 'Your files are ready.' : 'Thanks. One more step.'}</h1>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.6] text-muted">
          {entitled
            ? `Every value in the pack for ${domain} came out of this scan. Download it, drop the files in, and re-run the check.`
            : `The receipt went to the address you gave Stripe. Sign in with that address and the download unlocks; if the email has not arrived yet, give it a minute and reload.`}
        </p>
        <Card surface="ink" radius="panel" shadow="violet-5" className="mt-8 p-6">
          <TerminalLine className="border-0 bg-transparent px-0 py-0">$ claude &quot;apply botready-fixes.md&quot;</TerminalLine>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-on-ink-soft">
            The pack includes botready-fixes.md, a full prompt for your coding agent. Paste it into Claude Code or Cursor and your site fixes itself.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {entitled ? (
              <a href={`/api/fixpack/${id}`} className="edge inline-flex items-center rounded-[12px] bg-lime px-[22px] py-[14px] font-body text-[15px] font-bold text-ink no-underline shadow-hard-3 hover:bg-white">
                Download the fix pack
              </a>
            ) : (
              <Button href={`/sign-in?next=${encodeURIComponent(`/scan/${id}/purchased`)}`} tone="lime" size="lg" shadow={3} weight={700}>
                Sign in to download
              </Button>
            )}
            <Button href={`/scan/${id}`} tone="outline-white" size="lg">
              Back to the result
            </Button>
          </div>
        </Card>
        <p className="mt-6 text-[14px] leading-[1.6] text-muted">
          Something not right? Write to <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link> with the domain and we will sort it out.
        </p>
      </Container>
      <SiteFooter />
    </div>
  );
}
