import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ButtonLink, Footer, Measure, Nav, SectionHeading, Shell, buttonClass } from '@/components/primitives';
import { currentUser, hasFixpackEntitlement } from '@/lib/auth';
import { loadScanView } from '@/lib/scan-data';

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
    <Shell>
      <Nav />
      <Measure as="main" className="max-w-[760px] pb-14 pt-10">
        <p id="main" className="label text-pass">
          HTTP/1.1 200 OK · paid
        </p>
        <h1 className="display-section mt-3 text-[30px] sm:text-[36px]">
          Thanks. The fix pack for {domain} is generated.
        </h1>

        <div className="mt-8">
          {entitled ? (
            <>
              <SectionHeading kicker="Download">Four files and a punch list</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">Built from this scan. The result page keeps the download button too.</p>
              <a href={`/api/fixpack/${id}`} download={`botready-fixpack-${domain}.zip`} className={buttonClass('solid', 'md', 'mt-5')}>
                Download the fix pack
              </a>
            </>
          ) : user ? (
            <>
              <SectionHeading kicker="Almost there">The payment is being recorded</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">
                You are signed in as <span className="mono">{user.email}</span>. Reload this page in a few
                seconds. If the receipt went to a different address, sign in with that one instead.
              </p>
            </>
          ) : (
            <>
              <SectionHeading kicker="One more step">Open the link we emailed you</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">
                We have emailed a sign-in link to the address you gave Stripe. Open it and the download
                is on the result page. There is no password to set.
              </p>
              <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/scan/${id}`)}`} className="mt-5">
                Send the link again
              </ButtonLink>
            </>
          )}
        </div>

        <p className="mt-8 text-[14px] text-ink-60">
          <Link href={`/scan/${id}`} className="underline">
            Back to the result for {domain}
          </Link>
        </p>
      </Measure>
      <Footer />
    </Shell>
  );
}
