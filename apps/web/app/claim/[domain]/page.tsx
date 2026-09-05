import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { normaliseDomain } from '@botready/core';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Button, Container, Eyebrow, PageTitle } from '@/components/ui';
import { currentUser } from '@/lib/auth';
import { instructions } from '@/lib/claims';
import { PRICING, PUBLIC_INDEX_LISTED } from '@/lib/site';
import { publicClient } from '@/lib/supabase';
import { ClaimForm } from './ClaimForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  return { title: `Claim ${normaliseDomain(domain)}`, robots: { index: false, follow: false } };
}

/**
 * The claim flow. Claiming is the conversion moment on the index, and it is
 * verified by DNS TXT or a meta tag rather than by knowing the domain name.
 */
export default async function ClaimPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(raw);
  const user = await currentUser();

  const { data } = await publicClient()
    .from('sites')
    .select('id, is_claimed, claimed_by')
    .eq('domain', domain)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));
  const site = data as { id: string; is_claimed: boolean; claimed_by: string | null } | null;
  const mine = Boolean(user && site?.claimed_by === user.id);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <Container width={780} className="pb-24 pt-14">
          <PageTitle eyebrow="Claim" size="md" className="[&_h1]:break-all">
            {domain}
          </PageTitle>

          <div className="mt-10">
            {!site ? (
              <>
                <Section kicker="Not scanned yet">Run a check first</Section>
                <Lede>
                  A claim is only possible for a site we have already measured, because the claim proof is read from the
                  site itself.
                </Lede>
                <Button href="/" tone="ink" shadow={3} className="mt-6">
                  Check {domain}
                </Button>
              </>
            ) : !user ? (
              <>
                <Section kicker="Sign in first">A claim belongs to a person</Section>
                <Lede>Sign in with a one-time link and come back here.</Lede>
                <Button href={`/sign-in?next=${encodeURIComponent(`/claim/${domain}`)}`} tone="ink" shadow={3} className="mt-6">
                  Sign in
                </Button>
              </>
            ) : mine ? (
              <>
                <div className="edge rounded-[14px] bg-green-tint px-[22px] py-[18px] shadow-hard-3">
                  <Eyebrow as="p" tone="ink">
                    Claimed
                  </Eyebrow>
                  <h2 className="display mt-2 text-[24px]">You have proven control of {domain}</h2>
                  <p className="mt-2 text-[15px] leading-[1.6] text-body">
                    {PUBLIC_INDEX_LISTED
                      ? 'It shows as claimed on the index.'
                      : 'Open the app to see its history, its competitors and the files it generates.'}
                  </p>
                </div>
                <div className="mt-10">
                    <Section kicker={`Monitoring · ${PRICING.monitor.label} ${PRICING.monitor.cadence}`}>
                      Know the day a WAF rule changes under you
                    </Section>
                    <Lede>
                      Weekly re-checks, an alert on any category drop or a new 403 to any client, and the fix pack
                      regenerated on every scan.
                    </Lede>
                    {/* A plain anchor: the checkout route redirects to Stripe, which a client-side navigation cannot follow. */}
                    <a
                      href={`/api/checkout/monitor/${site.id}`}
                      className="edge mt-6 inline-flex items-center justify-center rounded-[10px] bg-ink px-4 py-[10px] font-body text-[14px] font-semibold text-white no-underline shadow-hard-3 transition-colors duration-150 hover:bg-violet hover:text-white"
                    >
                      Start monitoring — {PRICING.monitor.label} {PRICING.monitor.cadence}
                  </a>
                </div>
              </>
            ) : site.is_claimed ? (
              <>
                <Section kicker="Already claimed">Somebody has proven control of {domain}</Section>
                <Lede>
                  If that should be you, sign in with the address you used then, or prove it again below and the claim
                  moves.
                </Lede>
                <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
              </>
            ) : (
              <>
                <Section kicker="Prove control">Show us you own {domain}</Section>
                <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
              </>
            )}
          </div>

          <p className="mt-12 text-[14.5px] text-muted">
            {PUBLIC_INDEX_LISTED ? <Link href="/index/saas">Back to the index</Link> : <Link href="/account">Back to your domains</Link>}
          </p>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div>
      <Eyebrow as="p" tone="subtle">
        {kicker}
      </Eyebrow>
      <h2 className="display mt-2 text-[26px] sm:text-[30px]">{children}</h2>
    </div>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.6] text-muted">{children}</p>;
}
