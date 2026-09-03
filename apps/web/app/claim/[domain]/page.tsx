import type { Metadata } from 'next';
import Link from 'next/link';

import { normaliseDomain } from '@botready/core';

import { ButtonLink, Footer, Measure, Nav, SectionHeading, Shell, buttonClass } from '@/components/primitives';
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
    <Shell>
      <Nav />
      <Measure as="main" className="max-w-[780px] pb-14 pt-10">
        <p id="main" className="label text-ink-60">
          Claim
        </p>
        <h1 className="display-hero mt-3 break-all text-[36px] sm:text-[52px]">{domain}</h1>

        {subscribed ? (
          <p role="status" className="wire-line mt-6 border-l-[3px] border-pass pl-4 text-ink">
            Monitoring is on. We re-check {domain} weekly and email you the day a category drops or a
            client that could read the site cannot.
          </p>
        ) : null}

        <div className="mt-10">
          {!site ? (
            <>
              <SectionHeading kicker="Not scanned yet">Run a check first</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">
                A claim is only possible for a site we have already measured, because the claim proof
                is read from the site itself.
              </p>
              <ButtonLink href="/" className="mt-5">
                Check {domain}
              </ButtonLink>
            </>
          ) : !user ? (
            <>
              <SectionHeading kicker="Sign in first">A claim belongs to a person</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">Sign in with a one-time link and come back here.</p>
              <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/claim/${domain}`)}`} className="mt-5">
                Sign in
              </ButtonLink>
            </>
          ) : mine ? (
            <>
              <SectionHeading kicker="Claimed">You have proven control of {domain}</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">It shows as claimed on the index.</p>
              {!subscribed ? (
                <div className="mt-10">
                  <SectionHeading kicker={`Monitoring · ${PRICING.monitor.label} ${PRICING.monitor.cadence}`}>
                    Know the day a WAF rule changes under you
                  </SectionHeading>
                  <p className="mt-3 max-w-[60ch] text-[15px] text-ink-60">
                    Weekly re-checks, an alert on any category drop or a new 403 to any client, and the
                    fix pack regenerated on every scan.
                  </p>
                  <a href={`/api/checkout/monitor/${site.id}`} className={buttonClass('solid', 'md', 'mt-5')}>
                    Start monitoring
                  </a>
                </div>
              ) : null}
            </>
          ) : site.is_claimed ? (
            <>
              <SectionHeading kicker="Already claimed">Somebody has proven control of {domain}</SectionHeading>
              <p className="mt-3 text-[15px] text-ink-60">
                If that should be you, sign in with the address you used then, or prove it again below
                and the claim moves.
              </p>
              <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
            </>
          ) : (
            <>
              <SectionHeading kicker="Prove control">Publish the token where we say</SectionHeading>
              <ClaimForm domain={domain} instructions={instructions(user.id, domain)} />
            </>
          )}
        </div>

        <p className="mt-10 text-[14px] text-ink-60">
          <Link href="/index/saas" className="underline">
            Back to the index
          </Link>
        </p>
      </Measure>
      <Footer />
    </Shell>
  );
}
