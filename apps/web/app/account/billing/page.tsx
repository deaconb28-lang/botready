import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccountShell } from '@/components/account/AccountShell';
import { Lede, ListCard, ListRow, PageHeading, SectionHeading, inWords } from '@/components/account/bits';
import { Bar, PillEyebrow } from '@/components/ui';
import { planFor, usageFor } from '@/lib/account-data';
import { currentUser } from '@/lib/auth';
import { cardOnFile, listInvoices, type InvoiceLine } from '@/lib/billing';
import { PLAN_LIMITS, PRICING } from '@/lib/site';
import { formatDate } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Plan & billing',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PORTAL = '/api/billing/portal';

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account/billing');

  const plan = await planFor(user.id);
  const usage = await usageFor(user.id, plan);

  // Stripe is optional at runtime. When it is not configured, or the call
  // fails, the page still renders: no invoices, no card line.
  let invoices: InvoiceLine[] = [];
  let card: string | null = null;
  if (plan.stripeCustomerId) {
    const [inv, c] = await Promise.all([
      listInvoices(plan.stripeCustomerId).catch(() => [] as InvoiceLine[]),
      cardOnFile(plan.stripeCustomerId).catch(() => null),
    ]);
    invoices = inv;
    card = c;
  }

  const monitor = plan.plan === 'monitor';
  const renewLine = [monitor && plan.currentPeriodEnd ? `Renews ${renewalDate(plan.currentPeriodEnd)}` : null, card].filter(Boolean).join(' · ');

  const bars: Array<{ label: string; value: string; pct: number; color: string }> = [
    { label: 'Domains', value: `${usage.domains.used} of ${usage.domains.limit}`, pct: share(usage.domains.used, usage.domains.limit), color: '#4B44F5' },
    { label: 'Scans this month', value: `${usage.scans.used} of ${usage.scans.limit}`, pct: share(usage.scans.used, usage.scans.limit), color: '#C6F53C' },
    { label: 'Fix packs generated', value: String(usage.fixpacks.used), pct: Math.min(100, usage.fixpacks.used * 10), color: '#FFCF5C' },
  ];

  return (
    <AccountShell email={user.email} active="billing">
      <PageHeading>Your plan</PageHeading>
      <Lede className="mb-[26px] mt-[9px]">
        {monitor
          ? 'Monitoring, billed monthly. Cancel from this page whenever you like.'
          : `The free plan. One domain, ${inWords(PLAN_LIMITS.free.scansPerMonth)} checks a month, and nothing to cancel.`}
      </Lede>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[18px]">
        <section className="on-dark edge rounded-[18px] bg-violet p-[26px] text-white shadow-hard-5" aria-labelledby="current-plan">
          <PillEyebrow className="px-[11px] py-[3px] text-[10.5px]">
            <span id="current-plan">Current plan</span>
          </PillEyebrow>
          <div className="mb-[2px] mt-4 flex items-baseline gap-[9px]">
            <span className="font-display text-[46px] font-bold leading-none tracking-[-0.035em]">{monitor ? PRICING.monitor.label : 'Free'}</span>
            <span className="font-mono text-[12.5px] text-on-violet">{monitor ? PRICING.monitor.cadence : 'no card on file'}</span>
          </div>
          <p className="mb-[18px] mt-2 text-[15px] leading-[1.55] text-on-violet">
            {monitor
              ? `Weekly re-scans of up to ${plan.limits.domains} domains, alerts on any drop, and the fix pack regenerated every run.`
              : `One domain and ${PLAN_LIMITS.free.scansPerMonth} checks a month. The agency plan adds weekly re-scans of up to ${PLAN_LIMITS.monitor.domains} domains, alerts on any drop, and the fix pack regenerated every run, for ${PRICING.monitor.label} ${PRICING.monitor.cadence}.`}
          </p>
          <div className="flex flex-wrap gap-[10px]">
            {monitor ? (
              plan.stripeCustomerId ? (
                <>
                  <a href={PORTAL} className={LIME_BUTTON}>
                    Manage billing
                  </a>
                  <a href={PORTAL} className={OUTLINE_BUTTON}>
                    Cancel plan
                  </a>
                </>
              ) : null
            ) : (
              <>
                <Link href="/pricing" className={LIME_BUTTON}>
                  Start the agency plan
                </Link>
                {plan.stripeCustomerId ? (
                  <a href={PORTAL} className={OUTLINE_BUTTON}>
                    Manage billing
                  </a>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="edge rounded-[18px] bg-white p-[26px] shadow-hard-5" aria-label="This month">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-subtle">This month</span>
          <div className="mt-4 grid gap-4">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-body text-[14.5px] font-semibold">{b.label}</span>
                  <span className="whitespace-nowrap font-mono text-[13px] font-medium text-body">{b.value}</span>
                </div>
                <Bar pct={b.pct} color={b.color} className="mt-2" label={`${b.label}: ${b.value}`} />
              </div>
            ))}
          </div>
          {renewLine ? <p className="mt-[18px] font-mono text-[12.5px] text-subtle">{renewLine}</p> : null}
        </section>
      </div>

      <SectionHeading>Invoices</SectionHeading>
      <ListCard>
        {invoices.length === 0 ? (
          <div className="px-5 py-4 text-[15px] text-body">No invoices yet.</div>
        ) : (
          invoices.map((inv) => (
            <ListRow key={inv.id} className="px-5 py-[15px]">
              <span className="min-w-0 flex-1 font-body text-[14.5px] font-medium">{formatDate(inv.date)}</span>
              <span className="font-mono text-[13px] text-body">{inv.item}</span>
              <span className="font-mono text-[13px] font-bold">{inv.amount}</span>
              {inv.pdf ? (
                <a href={inv.pdf} target="_blank" rel="noreferrer" className="font-body text-[13px] font-medium">
                  PDF
                </a>
              ) : null}
            </ListRow>
          ))
        )}
      </ListCard>
    </AccountShell>
  );
}

const LIME_BUTTON =
  'edge inline-flex cursor-pointer items-center whitespace-nowrap rounded-[10px] bg-lime px-[18px] py-3 font-body text-[14px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white hover:text-ink';

const OUTLINE_BUTTON =
  'inline-flex cursor-pointer items-center whitespace-nowrap rounded-[10px] border-2 border-white bg-transparent px-[18px] py-3 font-body text-[14px] font-semibold text-white no-underline transition-colors duration-150 hover:bg-white hover:text-violet';

function share(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/** "1 October", the way the design prints it. */
function renewalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
