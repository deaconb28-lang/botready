import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ButtonLink, Card, CardHeading, Footer, Nav } from '@/components/primitives';
import { currentUser, hasFixpackEntitlement } from '@/lib/auth';
import { loadScanView } from '@/lib/scan-data';

export const metadata: Metadata = {
  title: 'Purchase complete',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends people after paying.
 *
 * The webhook that grants the entitlement usually lands before the browser
 * does, but not always, so this page copes with both orders: signed in with
 * the entitlement already there, signed in without it yet, and not signed in
 * at all (the common case, because buying never required an account).
 */
export default async function PurchasedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await loadScanView(id);
  if (!view) notFound();

  const user = await currentUser();
  const entitled = user ? await hasFixpackEntitlement(user.id) : false;
  const domain = view.site.domain;

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />
      <main id="main" className="max-w-[720px] px-5 pb-14 pt-12 sm:px-7">
        <p className="font-data text-[11px] uppercase tracking-[0.12em] text-pass">HTTP 200 · paid</p>
        <h1 className="mt-3 text-[26px] font-bold">Thanks. The fix pack for {domain} is generated.</h1>

        {entitled ? (
          <Card className="mt-6">
            <CardHeading>Download</CardHeading>
            <p className="text-[14px] text-ink-60">
              Four files and a punch list, built from this scan. The result page keeps the
              download button too.
            </p>
            <a
              href={`/api/fixpack/${id}`}
              download={`botready-fixpack-${domain}.zip`}
              className="mt-4 inline-block rounded-[4px] border border-ink bg-ink px-[18px] py-2.5 font-body text-[14px] font-semibold text-paper"
            >
              Download the fix pack
            </a>
          </Card>
        ) : user ? (
          <Card className="mt-6">
            <CardHeading>Almost there</CardHeading>
            <p className="text-[14px] text-ink-60">
              You are signed in as <span className="font-data">{user.email}</span> and the
              payment is being recorded. Reload this page in a few seconds. If the receipt went to a
              different address, sign in with that one instead.
            </p>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeading>One more step</CardHeading>
            <p className="text-[14px] text-ink-60">
              We have emailed a sign-in link to the address you gave Stripe. Open it and the
              download is on the result page. There is no password to set.
            </p>
            <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/scan/${id}`)}`} className="mt-4">
              Send the link again
            </ButtonLink>
          </Card>
        )}

        <p className="mt-6 text-[14px] text-ink-60">
          <Link href={`/scan/${id}`} className="underline">
            Back to the result for {domain}
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
