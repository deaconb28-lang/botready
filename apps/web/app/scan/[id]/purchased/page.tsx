import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { PromptPanel } from '@/components/results/PromptPanel';
import { MailNote } from '@/components/site/MailNote';
import { Button, Card, Container, TerminalLine, cx } from '@/components/ui';
import { currentUser, hasFixpackFor } from '@/lib/auth';
import { assembleFixPack } from '@/lib/fixpack';
import { verifiedPurchase } from '@/lib/purchase';
import { loadScanView } from '@/lib/scan-data';
import { PRICING } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Purchase complete',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends people after paying.
 *
 * It used to unlock on `currentUser()`, which showed the person who had just
 * paid the least of anyone: a payment link is a page Stripe hosts, nothing in
 * it creates a session here, and since sign-in became Google-only a buyer whose
 * card email is not a Google account could never get past it at all.
 *
 * Stripe's own return URL carries the checkout session id, and the session is
 * authoritative about whether money moved and what for. That is the proof now.
 * The signed-in entitlement still works, for anyone coming back later.
 *
 * The webhook that grants the
 * entitlement usually lands before the browser does, but not always, so this
 * page copes with both orders.
 */
export default async function PurchasedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;
  const view = await loadScanView(id);
  if (!view) notFound();

  const user = await currentUser();
  // Either proof is enough, and the session is checked first because it is the
  // one the person standing here almost certainly has.
  const purchase = await verifiedPurchase(sessionId);
  const paid = purchase?.scanId === id;
  const entitled = paid || (user ? await hasFixpackFor(user.id, view.site.domain) : false);
  const domain = view.site.domain;
  // Stripe knows the address the receipt went to; it is often not the address
  // the person is signed in with, and naming it is half of "check your spam".
  const buyerEmail = (paid ? purchase?.email : null) ?? user?.email ?? null;

  // The prompt goes on the page, not just into a zip. It is the thing they act
  // on, and making them open an email to see it is a step nobody needs.
  const pack = entitled ? assembleFixPack(view, id) : null;
  const downloadHref = paid && sessionId ? `/api/fixpack/${id}?session_id=${encodeURIComponent(sessionId)}` : `/api/fixpack/${id}`;

  // Where the next step goes. Their own claimed property opens the app; anyone
  // else is one DNS record away from having one.
  const claimedByThem = view.site.claimed_by !== null && view.site.claimed_by === user?.id;
  const nextHref = claimedByThem ? `/app/${domain}` : `/claim/${domain}`;
  const nextLabel = claimedByThem ? 'Open your dashboard' : `Claim ${domain}`;

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={760} className="pb-24 pt-14">
        <span className="eyebrow text-subtle-2">Fix pack</span>
        <h1 className="display-tight mt-3 text-[clamp(34px,5vw,56px)]">
          {entitled ? 'Your site is now BotReady!' : 'Thanks. One more step.'}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-muted">
          {entitled
            ? `Everything for ${domain} is on this page.`
            : 'Stripe is still confirming. Reload in a minute, or sign in with the address you paid with.'}
        </p>

        <Card surface="ink" radius="panel" shadow="violet-5" className="mt-8 p-6">
          <TerminalLine className="border-0 bg-transparent px-0 py-0">$ claude &quot;apply botready-fixes.md&quot;</TerminalLine>
          <div className="mt-5 flex flex-wrap gap-3">
            {entitled ? (
              <a href={downloadHref} className="edge inline-flex items-center rounded-[12px] bg-lime px-[22px] py-[14px] font-body text-[15px] font-bold text-ink no-underline shadow-hard-3 hover:bg-white">
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

        {/* The next thing worth doing, and the only thing on this page that is
            still for sale. Applying the pack is a one-off; a firewall rule
            changing under them next month is not, and they will not think to
            come back and check. */}
        {entitled ? (
          <Card surface="lime" radius="panel" shadow={5} className="mt-6 p-6">
            <h2 className="display text-[20px]">Keep it that way</h2>
            <p className="mt-2 max-w-[46ch] text-[15px] leading-[1.55] text-ink">
              Claim the domain and we re-check it weekly, then write to you the day a client that could read it stops being
              able to. {PRICING.monitor.label} {PRICING.monitor.cadence}.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a href={nextHref} className="edge inline-flex items-center rounded-[12px] bg-ink px-[22px] py-[14px] font-body text-[15px] font-bold text-white no-underline shadow-hard-3 hover:bg-violet">
                {nextLabel}
              </a>
              <span className="font-mono text-[12px] text-ink">Two minutes, one DNS record</span>
            </div>
          </Card>
        ) : null}

        <div className="mt-6">
          <MailNote to={buyerEmail} />
        </div>

        {pack ? <PromptPanel prompt={pack.agentPrompt} filename="botready-fixes.md" /> : null}

        {pack ? (
          <section className="mt-8">
            <h2 className="display text-[22px]">Everything in the pack</h2>
            <Card radius="card-lg" shadow={4} className="mt-3 overflow-hidden">
              <ul className="m-0 list-none p-0">
                {pack.names.map((name, i) => (
                  <li
                    key={name}
                    className={cx('flex items-center gap-4 px-[22px] py-[13px]', i < pack.names.length - 1 && 'border-b border-hairline-2')}
                  >
                    <span className="font-mono text-[13px] font-medium">{name}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </Container>
      <SiteFooter />
    </div>
  );
}
