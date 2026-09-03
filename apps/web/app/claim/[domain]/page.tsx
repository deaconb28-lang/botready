import type { Metadata } from 'next';
import Link from 'next/link';

import { normaliseDomain } from '@botready/core';

import { ButtonLink, Card, CardHeading, Footer, Nav } from '@/components/primitives';
import { currentUser } from '@/lib/auth';
import { instructions } from '@/lib/claims';
import { PRICING } from '@/lib/site';
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
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const { domain: raw } = await params;
  const { subscribed } = await searchParams;
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
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />
      <main id="main" className="max-w-[760px] px-5 pb-14 pt-10 sm:px-7">
        <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink-60">Claim</p>
        <h1 className="mt-2 text-[26px] font-bold">
          <span className="font-data">{domain}</span>
        </h1>

        {subscribed ? (
          <p role="status" className="mt-4 rounded-[5px] border border-pass border-l-[3px] bg-card px-[18px] py-3 text-[14px]">
            Monitoring is on. We re-check {domain} weekly and email you the day a category drops or a
            client that could read the site cannot.
          </p>
        ) : null}

        {!site ? (
          <Card className="mt-6">
            <CardHeading>Not scanned yet</CardHeading>
            <p className="text-[14px] text-ink-60">
              A claim is only possible for a site we have already measured, because the claim
              proof is read from the site itself. Run a check first.
            </p>
            <ButtonLink href="/" className="mt-4">
              Check {domain}
            </ButtonLink>
          </Card>
        ) : !user ? (
          <Card className="mt-6">
            <CardHeading>Sign in first</CardHeading>
            <p className="text-[14px] text-ink-60">
              A claim belongs to a person. Sign in with a one-time link and come back here.
            </p>
            <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/claim/${domain}`)}`} className="mt-4">
              Sign in
            </ButtonLink>
          </Card>
        ) : mine ? (
          <>
            <Card className="mt-6">
              <CardHeading>Claimed</CardHeading>
              <p className="text-[14px] text-ink-60">
                You have proven control of {domain}. It shows as claimed on the index.
              </p>
            </Card>
            {!subscribed ? (
              <Card className="mt-4">
                <CardHeading>Monitoring · {PRICING.monitor.label} {PRICING.monitor.cadence}</CardHeading>
                <p className="text-[14px] text-ink-60">
                  Weekly re-checks, an alert on any category drop or a new 403 to any client, and the
                  fix pack regenerated on every scan.
                </p>
                <a
                  href={`/api/checkout/monitor/${site.id}`}
                  className="mt-4 inline-block rounded-[4px] border border-ink bg-ink px-[18px] py-2.5 font-body text-[14px] font-semibold text-paper"
                >
                  Start monitoring
                </a>
              </Card>
            ) : null}
          </>
        ) : site.is_claimed ? (
          <Card className="mt-6">
            <CardHeading>Already claimed</CardHeading>
            <p className="text-[14px] text-ink-60">
              Somebody has already proven control of {domain}. If that should be you, sign in with
              the address you used then, or prove it again below and the claim moves.
            </p>
            <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
          </Card>
        ) : (
          <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
        )}

        <p className="mt-8 text-[14px] text-ink-60">
          <Link href="/index/saas" className="underline">
            Back to the index
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
