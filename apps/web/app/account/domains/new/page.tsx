import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { normaliseDomain } from '@botready/core';

import { AccountShell } from '@/components/account/AccountShell';
import { Lede, PageHeading, inWords } from '@/components/account/bits';
import { NewDomainForm } from '@/components/account/NewDomainForm';
import { loadDomains, planFor, usageFor } from '@/lib/account-data';
import { currentUser } from '@/lib/auth';
import { PLAN_LIMITS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Add a domain',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * A domain is claimed after a check, on the claim page, by proving control of
 * it. This page starts the check. A domain this person already holds can be
 * re-checked from here whatever the slot count says.
 */
export default async function NewDomainPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account/domains/new');

  const { domain: rawDomain } = await searchParams;
  const prefill = rawDomain ? normaliseDomain(rawDomain) : '';

  const plan = await planFor(user.id);
  const [usage, domains] = await Promise.all([usageFor(user.id, plan), loadDomains(user.id)]);
  const alreadyMine = prefill !== '' && domains.some((d) => d.domain === prefill);
  const full = usage.domains.used >= usage.domains.limit && !alreadyMine;

  return (
    <AccountShell email={user.email} active="domains">
      <p className="mb-3">
        <Link href="/account" className="font-mono text-[12.5px]">
          ← Your domains
        </Link>
      </p>
      <PageHeading>{alreadyMine ? `Re-check ${prefill}` : 'Add a domain'}</PageHeading>

      {full ? (
        <>
          <Lede className="mt-[9px] max-w-[60ch]">
            {plan.plan === 'monitor'
              ? `Every slot on the monitoring plan is in use: ${inWords(usage.domains.used)} of ${inWords(usage.domains.limit)}. Remove a domain to make room for this one.`
              : `The free plan holds one domain and yours is in it. Monitoring watches up to ${inWords(PLAN_LIMITS.monitor.domains)} domains and re-checks them every week.`}
          </Lede>
          <div className="mt-6 flex flex-wrap gap-[10px]">
            {plan.plan === 'free' ? (
              <Link
                href="/pricing"
                className="edge whitespace-nowrap rounded-[12px] bg-lime px-[22px] py-[13px] font-body text-[14.5px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white hover:text-ink"
              >
                See the plans
              </Link>
            ) : null}
            <Link
              href="/account"
              className="edge whitespace-nowrap rounded-[12px] bg-white px-[22px] py-[13px] font-body text-[14.5px] font-semibold text-ink no-underline transition-colors duration-150 hover:bg-lime hover:text-ink"
            >
              Back to your domains
            </Link>
          </div>
        </>
      ) : (
        <>
          <Lede className="mb-[26px] mt-[9px] max-w-[60ch]">
            {alreadyMine
              ? 'We fetch the site again as five clients and write the result into its history.'
              : 'We check the site first, then send you to the claim page, where you prove the domain is yours with a DNS record or a meta tag. Claimed domains keep their history and get the weekly re-check.'}
          </Lede>
          <NewDomainForm initialDomain={prefill} />
        </>
      )}
    </AccountShell>
  );
}
