import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccountShell } from '@/components/account/AccountShell';
import { AlertDot, Lede, ListCard, ListRow, PageHeading, SectionHeading, StatusPill, capitalise, inWords, planLabel } from '@/components/account/bits';
import { cx } from '@/components/ui';
import { loadAlerts, loadDomains, planFor, usageFor, type DomainCard } from '@/lib/account-data';
import { currentUser } from '@/lib/auth';
import { PLAN_LIMITS } from '@/lib/site';
import { CLIENT_IDS, gradeIsHealthy, relativeTime } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Your domains',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account');

  const plan = await planFor(user.id);
  const [domains, alerts, usage] = await Promise.all([loadDomains(user.id), loadAlerts(user.id), usageFor(user.id, plan)]);
  const slotsLeft = Math.max(0, usage.domains.limit - usage.domains.used);

  return (
    <AccountShell email={user.email} active="domains">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <PageHeading>Your domains</PageHeading>
          <Lede className="mt-[9px]">
            {capitalise(inWords(usage.domains.used))} of {inWords(usage.domains.limit)} {usage.domains.limit === 1 ? 'slot' : 'slots'} used on the {planLabel(plan.plan)} plan.
          </Lede>
        </div>
        {slotsLeft > 0 ? (
          <Link
            href="/account/domains/new"
            className="edge whitespace-nowrap rounded-[12px] bg-lime px-[22px] py-[13px] font-body text-[14.5px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white hover:text-ink"
          >
            Add a domain
          </Link>
        ) : null}
      </div>

      <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[18px]">
        {domains.map((d) => (
          <DomainPanel key={d.siteId} card={d} />
        ))}

        {slotsLeft > 0 ? (
          <div
            className="flex flex-col items-start justify-center gap-[10px] rounded-[16px] bg-surface-alt p-[22px]"
            style={{ border: '2px dashed var(--color-dashed)' }}
          >
            <div className="font-body text-[16px] font-bold text-body">
              {capitalise(inWords(slotsLeft))} {slotsLeft === 1 ? 'slot' : 'slots'} left
            </div>
            <p className="text-[14.5px] leading-[1.5] text-quiet">
              {domains.length === 0
                ? 'Run a check on your site, then claim it here and we keep the history.'
                : 'Add a staging domain or a docs subdomain — they score separately.'}
            </p>
            <Link
              href="/account/domains/new"
              className="edge rounded-[10px] bg-white px-4 py-[10px] font-body text-[14px] font-semibold text-ink no-underline transition-colors duration-150 hover:bg-lime hover:text-ink"
            >
              Add a domain
            </Link>
          </div>
        ) : (
          <div
            className="flex flex-col items-start justify-center gap-[10px] rounded-[16px] bg-surface-alt p-[22px]"
            style={{ border: '2px dashed var(--color-dashed)' }}
          >
            <div className="font-body text-[16px] font-bold text-body">
              {plan.plan === 'monitor' ? 'Every slot is in use' : 'The free plan holds one domain'}
            </div>
            <p className="text-[14.5px] leading-[1.5] text-quiet">
              {plan.plan === 'monitor'
                ? `The agency plan watches ${inWords(plan.limits.domains)} domains. Remove one to make room.`
                : `The agency plan watches up to ${inWords(PLAN_LIMITS.monitor.domains)} domains and re-checks them every week.`}
            </p>
            <Link
              href="/pricing"
              className="edge rounded-[10px] bg-white px-4 py-[10px] font-body text-[14px] font-semibold text-ink no-underline transition-colors duration-150 hover:bg-lime hover:text-ink"
            >
              See the plans
            </Link>
          </div>
        )}
      </div>

      <SectionHeading>Recent alerts</SectionHeading>
      <ListCard>
        {alerts.length === 0 ? (
          <div className="px-5 py-4 text-[15px] text-body">No alerts yet. We write one the day something changes.</div>
        ) : (
          alerts.map((a) => (
            <ListRow key={a.id} className="px-5 py-4">
              <AlertDot bad={a.bad} />
              <span className="min-w-0 flex-1 text-[15px]">
                {a.scanId ? (
                  <Link href={`/scan/${a.scanId}`} className="text-ink no-underline hover:underline">
                    {a.text}
                  </Link>
                ) : (
                  a.text
                )}
              </span>
              <span className="whitespace-nowrap font-mono text-[12px] text-subtle">{relativeTime(a.when)}</span>
            </ListRow>
          ))
        )}
      </ListCard>
    </AccountShell>
  );
}

function DomainPanel({ card }: { card: DomainCard }) {
  const checked =
    card.finishedAt ? `re-checked ${relativeTime(card.finishedAt)}` : card.status === 'queued' || card.status === 'running' ? 'check running' : 'not checked yet';

  return (
    <article className="edge rounded-[16px] bg-white p-[22px] shadow-hard-4">
      <div className="flex items-start justify-between gap-[14px]">
        <div className="min-w-0">
          <h2 className="break-all font-body text-[17px] font-bold tracking-normal">
            <Link href={`/app/${card.domain}`} className="text-ink no-underline hover:underline">
              {card.domain}
            </Link>
          </h2>
          <div className="mt-1 font-mono text-[12.5px] text-subtle">{checked}</div>
        </div>
        <Grade card={card} />
      </div>

      {card.clients.length > 0 ? (
        <ul className="m-0 mt-[18px] grid list-none gap-2 p-0">
          {card.clients.map((c) => (
            <li key={c.id} className="flex items-center gap-[10px] font-mono text-[12.5px]">
              <span className="min-w-0 flex-1 text-body">{CLIENT_IDS[c.id] ?? c.id}</span>
              <StatusPill ok={c.ok}>{c.status === 0 ? 'ERR' : c.status}</StatusPill>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cx('edge mt-[18px] rounded-[12px] px-[13px] py-[11px] text-[14.5px] leading-[1.5] text-ink', card.alert.bad ? 'bg-coral-tint' : 'bg-green-tint')}>
        {card.alert.text}
        {!card.score && card.status !== 'queued' && card.status !== 'running' ? (
          <>
            {' '}
            <Link href={`/account/domains/new?domain=${encodeURIComponent(card.domain)}`} className="whitespace-nowrap">
              Run a check
            </Link>
          </>
        ) : null}
      </div>
    </article>
  );
}

function Grade({ card }: { card: DomainCard }) {
  if (card.score) {
    const healthy = gradeIsHealthy(card.score.grade);
    return (
      <div
        className={cx(
          'edge flex-none rounded-[12px] px-[14px] py-2 font-display text-[22px] font-bold leading-[1.15] tracking-[-0.03em]',
          healthy ? 'bg-green text-white' : 'bg-coral text-ink',
        )}
        aria-label={`Grade ${card.score.grade}, ${card.score.total} of 100`}
      >
        {card.score.grade}
      </div>
    );
  }
  const label = card.status === 'blocked' ? 'Blocked' : card.status === 'queued' || card.status === 'running' ? 'Running' : 'Not scanned yet';
  return <div className="edge flex-none whitespace-nowrap rounded-[12px] bg-canvas px-[14px] py-2 font-mono text-[12.5px] font-medium text-body">{label}</div>;
}
