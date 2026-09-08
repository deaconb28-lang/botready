import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryDef, checkDef, type CategoryKey } from '@botready/core';

import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow, cx } from '@/components/ui';
import { currentAdmin } from '@/lib/admin';
import { loadAdminMetrics, type AdminMetrics } from '@/lib/admin-metrics';

export const metadata: Metadata = {
  title: 'Dashboard',
  // Not in the sitemap, not in search, not followed. The gate is the real
  // protection; this is so the URL does not turn up in a search result and
  // invite people to rattle the handle.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The internal dashboard: the whole business on one page.
 *
 * notFound() rather than a redirect or a 403 for anybody not on the allowlist,
 * so the route is indistinguishable from one that does not exist. A 403 tells a
 * stranger there is something here worth getting into.
 *
 * The gate runs once, here, before any query. Nothing in lib/admin-metrics.ts
 * checks anything — it reads with the service client and sees every row on the
 * platform, which is exactly why it must never be reachable from a route that
 * has not already done this.
 */
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) notFound();

  const m = await loadAdminMetrics();

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={1120} className="pb-24 pt-12">
        <Eyebrow>Internal</Eyebrow>
        <h1 className="display-tight mt-3 text-[clamp(30px,4vw,46px)]">Everything, right now</h1>
        <p className="mt-3 font-mono text-[12.5px] text-subtle-2">
          {admin.email} · read live · {new Date(m.generatedAt).toUTCString()}
        </p>

        <Funnel m={m} />
        <Revenue m={m} />
        <Activity m={m} />
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
          <Triggers m={m} />
          <Outcomes m={m} />
        </div>
        <Checks m={m} />
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
          <Categories m={m} />
          <Timing m={m} />
        </div>
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
          <Reach m={m} />
          <Health m={m} />
        </div>
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
          <TopDomains m={m} />
          <RecentScans m={m} />
        </div>
      </Container>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Stat({ n, label, tone }: { n: string | number; label: string; tone?: 'coral' | 'green' }) {
  return (
    <div>
      <div
        className={cx(
          'display text-[clamp(22px,2.8vw,34px)] leading-none tracking-[-0.03em]',
          tone === 'coral' ? 'text-coral-text' : tone === 'green' ? 'text-green-text' : 'text-ink',
        )}
      >
        {n}
      </div>
      <div className="mt-[7px] text-[13px] leading-[1.4] text-muted">{label}</div>
    </div>
  );
}

/** A labelled bar with its number on the right. Used by four panels. */
function BarRow({
  label,
  sub,
  value,
  width,
  colour,
  mono,
}: {
  label: string;
  sub?: string;
  value: string | number;
  width: number;
  colour: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(120px,1.1fr)_2fr_auto] items-center gap-3">
      <div className="min-w-0">
        <div className={cx('truncate text-[13.5px] text-ink', mono && 'font-mono text-[12.5px]')} title={label}>
          {label}
        </div>
        {sub ? <div className="truncate font-mono text-[10.5px] text-placeholder">{sub}</div> : null}
      </div>
      <div>
        <span
          className={cx('edge block h-[14px] rounded-[5px]', colour)}
          style={{ width: `${Math.max(2, width)}%` }}
        />
      </div>
      <div className="w-[52px] text-right font-mono text-[12.5px] tabular-nums text-ink">{value}</div>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">{children}</span>
  );
}

// ------------------------------------------------------------------ panels

function Funnel({ m }: { m: AdminMetrics }) {
  const { funnel } = m;
  return (
    <Card radius="panel" shadow={5} className="mt-8 p-6 sm:p-7">
      <Eyebrow>The funnel</Eyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:grid-cols-7">
        <Stat n={funnel.scans} label="scans run, all time" />
        <Stat n={funnel.scored} label="produced a score" />
        <Stat n={funnel.accounts} label="accounts" />
        <Stat n={funnel.claimed} label="domains claimed" />
        <Stat n={funnel.packs} label="fix packs sold" tone="green" />
        <Stat n={funnel.subscriptions} label="live subscriptions" tone="green" />
        <Stat n={`${funnel.conversion}%`} label="scans that became a sale" />
      </div>
    </Card>
  );
}

function Revenue({ m }: { m: AdminMetrics }) {
  const r = m.revenue;
  const money = (n: number) => `$${n.toLocaleString('en-US')}`;

  // Not a zero. A zero here is indistinguishable from no sales, and this panel
  // is the one that must not lie about that.
  if (!r.available) {
    return (
      <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
        <Eyebrow>Money</Eyebrow>
        <p className="mt-4 text-[15px] leading-[1.55] text-muted">
          Stripe did not answer, so there is nothing to show here. This is not a report of zero revenue — it is the
          absence of a report. Check STRIPE_SECRET_KEY.
        </p>
      </Card>
    );
  }

  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Money</Eyebrow>
        {/* Said out loud because the two numbers below would otherwise look
            like they disagree with the row counts above them. */}
        <span className="font-mono text-[11.5px] text-subtle-2">
          botready only, from Stripe, net of refunds
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        <Stat n={money(r.grossAllTime)} label="collected, all time" tone="green" />
        <Stat n={money(r.gross30d)} label="last 30 days" />
        <Stat n={money(r.gross7d)} label="last 7 days" />
        {/* An em dash, not $0. Stripe answering about charges and not about
            subscriptions is one broken number, and it says which one. */}
        <Stat
          n={r.mrr === null ? '—' : money(r.mrr)}
          label={r.mrr === null ? 'monthly recurring — Stripe did not say' : 'monthly recurring'}
          tone={r.mrr === null ? undefined : 'green'}
        />
        <Stat n={`$${r.averageOrder.toFixed(2)}`} label="average payment" />
        <Stat n={r.refunded > 0 ? money(r.refunded) : '$0'} label="refunded" tone={r.refunded > 0 ? 'coral' : undefined} />
      </div>
      {/* This Stripe account takes money for more than one business, so the
          filter has to be visible: a number that quietly drops sales is the
          same size of mistake as one that quietly counts somebody else's. */}
      {r.excluded > 0 ? (
        <p className="mt-6 text-[13px] leading-[1.5] text-muted">
          {r.excluded} other {r.excluded === 1 ? 'payment' : 'payments'} on this Stripe account {r.excluded === 1 ? 'is' : 'are'}{' '}
          not botready and {r.excluded === 1 ? 'is' : 'are'} excluded from every figure above.
        </p>
      ) : null}
      {r.recent.length > 0 ? (
        <div className="mt-7 border-t-2 border-hairline pt-5">
          <SubHead>Latest payments</SubHead>
          <ul className="m-0 mt-3 grid list-none gap-[9px] p-0">
            {r.recent.map((p, i) => (
              <li key={`${p.date}-${i}`} className="flex items-baseline justify-between gap-4 font-mono text-[12.5px]">
                <span className="truncate text-subtle-2">
                  {p.date.slice(0, 10)} · <span className="text-ink">{p.description}</span>
                  {p.refunded ? <span className="text-coral-text"> · refunded</span> : null}
                </span>
                <span className="whitespace-nowrap tabular-nums text-ink">${p.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Activity({ m }: { m: AdminMetrics }) {
  const peak = Math.max(1, ...m.activity.daily.map((d) => d.total));
  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Scans, last thirty days</Eyebrow>
        <span className="font-mono text-[12.5px] text-subtle-2">
          <span className="text-ink">{m.activity.last24h}</span> today ·{' '}
          <span className="text-ink">{m.activity.last7d}</span> this week ·{' '}
          <span className="text-ink">{m.activity.last30d}</span> this month
        </span>
      </div>
      {/* A bar per day including the empty ones, so a quiet week reads as a
          quiet week rather than as a short chart. Stacked by outcome, because a
          day of 40 scans where 12 errored is not the same day as 40 clean ones
          and a single-colour bar says it is. */}
      <div className="mt-6 flex h-[132px] items-end gap-[3px]">
        {m.activity.daily.map((d) => {
          const h = (n: number) => (d.total === 0 ? 0 : Math.max(n > 0 ? 2 : 0, (n / peak) * 96));
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-[5px]">
              <span className="font-mono text-[9px] text-subtle-2">{d.total || ''}</span>
              <span
                className="flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]"
                style={{ border: d.total > 0 ? '2px solid #111318' : 'none' }}
                title={`${d.day}: ${d.total} scans, ${d.complete} complete, ${d.blocked} blocked, ${d.errored} errored`}
              >
                <span className="block w-full bg-lime" style={{ height: `${h(d.complete)}px` }} />
                <span className="block w-full bg-amber" style={{ height: `${h(d.blocked)}px` }} />
                <span className="block w-full bg-coral" style={{ height: `${h(d.errored)}px` }} />
              </span>
              <span className="font-mono text-[8.5px] text-placeholder">{d.day.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 font-mono text-[11px] text-subtle-2">
        <Key colour="bg-lime" label="complete" />
        <Key colour="bg-amber" label="blocked" />
        <Key colour="bg-coral" label="errored" />
      </div>
    </Card>
  );
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className={cx('edge inline-block h-[10px] w-[10px] rounded-[3px]', colour)} />
      {label}
    </span>
  );
}

function Triggers({ m }: { m: AdminMetrics }) {
  const peak = Math.max(1, ...m.activity.triggers.map((t) => t.total));
  const words: Record<string, string> = {
    manual: 'somebody typed a URL',
    index: 'the nightly index cron',
    monitor: 'a subscriber’s schedule',
    cron: 'a scheduled re-scan',
    competitor: 'added as a competitor',
  };
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>Where scans come from</Eyebrow>
      <div className="mt-5 grid gap-[13px]">
        {m.activity.triggers.map((t) => (
          <BarRow
            key={t.trigger}
            label={t.trigger}
            sub={words[t.trigger] ?? ''}
            value={t.total}
            width={(t.total / peak) * 100}
            colour="bg-violet"
            mono
          />
        ))}
      </div>
      {/* The ratio worth watching. A corpus that is mostly our own cron is a
          corpus, not an audience. */}
      <p className="mt-6 border-t-2 border-hairline pt-4 text-[13px] leading-[1.5] text-muted">
        {share(m.activity.triggers, 'manual')}% of every scan we have ever run was somebody typing a URL in.
      </p>
    </Card>
  );
}

function share(triggers: AdminMetrics['activity']['triggers'], which: string): number {
  const all = triggers.reduce((sum, t) => sum + t.total, 0);
  const one = triggers.find((t) => t.trigger === which)?.total ?? 0;
  return all > 0 ? Math.round((one / all) * 100) : 0;
}

function Outcomes({ m }: { m: AdminMetrics }) {
  const { outcomes } = m;
  const most = Math.max(1, ...outcomes.grades.map((g) => g.count));
  const colour: Record<string, string> = {
    A: 'bg-green',
    B: 'bg-lime',
    C: 'bg-amber',
    D: 'bg-coral',
    F: 'bg-coral',
  };
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>What the corpus scores</Eyebrow>
      <div className="mt-5 grid grid-cols-4 gap-4">
        <Stat n={outcomes.seen} label="sites seen" />
        <Stat n={outcomes.ranked} label="ranked" />
        <Stat n={outcomes.averageScore} label="average" />
        <Stat n={outcomes.blocked} label="refused us" tone="coral" />
      </div>
      <dl className="mt-7 grid gap-[10px]">
        {outcomes.grades.map((g) => (
          <div key={g.grade} className="flex items-center gap-3">
            <dt className="display w-[18px] text-[15px] text-ink">{g.grade}</dt>
            <dd className="m-0 flex-1">
              <span
                className={cx('edge block h-[16px] rounded-[5px]', colour[g.grade] ?? 'bg-lime')}
                style={{ width: `${Math.max(2, (g.count / most) * 100)}%` }}
              />
            </dd>
            <dd className="m-0 w-[34px] text-right font-mono text-[12.5px] tabular-nums text-ink">
              {g.count}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Categories({ m }: { m: AdminMetrics }) {
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>Where the web is weakest</Eyebrow>
      <p className="mt-3 text-[13px] leading-[1.5] text-muted">
        Average category score across every ranked site, worst first. This is the shape of the whole corpus, and it
        is what the fix pack has to move.
      </p>
      <div className="mt-6 grid gap-[13px]">
        {m.outcomes.categories.map((c) => (
          <BarRow
            key={c.category}
            label={categoryDef(c.category as CategoryKey)?.label ?? c.category}
            value={c.average}
            width={c.average}
            colour={c.average < 40 ? 'bg-coral' : c.average < 70 ? 'bg-amber' : 'bg-lime'}
          />
        ))}
      </div>
    </Card>
  );
}

function Checks({ m }: { m: AdminMetrics }) {
  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>What the web fails</Eyebrow>
        <span className="font-mono text-[11.5px] text-subtle-2">one scan per site · skips excluded from the rate</span>
      </div>
      <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.5] text-muted">
        Every check, ordered by how often it fails. Counted over the newest settled scan of each site rather than
        over all evidence, because counting every scan weights a domain by how many times we happen to have scanned
        it — which turns our own test targets into a statement about the internet.
      </p>
      <div className="mt-6 grid gap-[11px]">
        {m.checks.map((c) => (
          <BarRow
            key={c.key}
            label={checkDef(c.key)?.label ?? c.key}
            sub={`${c.key} · ${c.fails} fail · ${c.passes} pass${c.skips > 0 ? ` · ${c.skips} exempt` : ''}`}
            value={`${c.failRate}%`}
            width={c.failRate}
            colour={c.failRate >= 60 ? 'bg-coral' : c.failRate >= 30 ? 'bg-amber' : 'bg-lime'}
          />
        ))}
      </div>
    </Card>
  );
}

function Timing({ m }: { m: AdminMetrics }) {
  const { timing } = m;
  const slowest = Math.max(1, ...timing.slowestChecks.map((c) => c.avgMs));
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>What a scan costs</Eyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <Stat n={`${timing.p50}s`} label="median scan" />
        <Stat n={`${timing.p95}s`} label="95th percentile" tone={timing.p95 > 120 ? 'coral' : undefined} />
        <Stat n={`${timing.slowest}s`} label="slowest ever" />
        <Stat n={timing.avgPages} label="pages per scan" />
      </div>
      {timing.slowestChecks.length > 0 ? (
        <div className="mt-7 border-t-2 border-hairline pt-5">
          <SubHead>Slowest checks, mean</SubHead>
          <div className="mt-4 grid gap-[11px]">
            {timing.slowestChecks.map((c) => (
              <BarRow
                key={c.key}
                label={checkDef(c.key)?.label ?? c.key}
                value={`${(c.avgMs / 1000).toFixed(1)}s`}
                width={(c.avgMs / slowest) * 100}
                colour="bg-violet"
              />
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-5 text-[12.5px] leading-[1.5] text-subtle-2">
        Measured over {timing.measured} scans that recorded both a start and a finish.
      </p>
    </Card>
  );
}

function Reach({ m }: { m: AdminMetrics }) {
  const { reach } = m;
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>What people do with it</Eyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
        <Stat n={reach.monitors} label="active monitors" />
        <Stat n={reach.prompts} label="watched questions" />
        <Stat n={reach.promptRuns} label="answers recorded" />
        <Stat n={reach.competitors} label="competitors added" />
        <Stat n={reach.alerts} label="alerts sent" />
        <Stat n={reach.rescanned} label="domains scanned twice" />
      </div>
      {/* The honest reading of a mostly-empty panel, said here so it does not
          have to be rediscovered every time somebody looks at it. */}
      <p className="mt-6 border-t-2 border-hairline pt-4 text-[13px] leading-[1.5] text-muted">
        Everything here is a feature somebody had to come back to use. A row of zeroes is not a broken query — it
        means the product is being used once and abandoned, which is the number the subscription has to move.
      </p>
    </Card>
  );
}

function TopDomains({ m }: { m: AdminMetrics }) {
  const peak = Math.max(1, ...m.reach.topDomains.map((d) => d.scans));
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>Most scanned</Eyebrow>
      <div className="mt-5 grid gap-[11px]">
        {m.reach.topDomains.map((d) => (
          <BarRow
            key={d.domain}
            label={d.domain}
            sub={d.lastScan ? `last ${d.lastScan.slice(0, 10)}` : undefined}
            value={d.scans}
            width={(d.scans / peak) * 100}
            colour="bg-violet"
            mono
          />
        ))}
      </div>
    </Card>
  );
}

function RecentScans({ m }: { m: AdminMetrics }) {
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>Latest results</Eyebrow>
      <ul className="m-0 mt-5 grid list-none gap-[10px] p-0">
        {m.recentScans.map((s, i) => (
          <li key={`${s.domain}-${i}`} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink" title={s.domain}>
              {s.domain}
            </span>
            <span className="font-mono text-[11px] text-placeholder">{s.at ? s.at.slice(0, 10) : ''}</span>
            <span
              className={cx(
                'edge w-[42px] rounded-[7px] px-[7px] py-[2px] text-center font-mono text-[11.5px] font-bold',
                s.status === 'blocked' ? 'bg-coral text-ink'
                : s.total === null ? 'bg-surface-alt text-subtle-2'
                : s.total >= 80 ? 'bg-green text-white'
                : s.total >= 60 ? 'bg-lime text-ink'
                : 'bg-amber text-ink',
              )}
            >
              {s.status === 'blocked' ? '403' : (s.grade ?? '—')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Health({ m }: { m: AdminMetrics }) {
  const { health } = m;
  // Each of these should be zero. Colouring them by whether they are is the
  // whole reason the panel exists — a number nobody has a threshold for is a
  // number nobody acts on.
  const rows: Array<{ label: string; n: number; note: string }> = [
    { label: 'Unscored', n: health.unscored, note: 'complete, has evidence, no score row' },
    { label: 'Stuck', n: health.stuck, note: 'running for over an hour' },
    { label: 'Queued', n: health.queued, note: 'waiting for the worker' },
    { label: 'Errored', n: health.errored, note: `in the last 24 hours · ${health.erroredAllTime} ever` },
  ];
  return (
    <Card radius="panel" shadow={5} className="p-6 sm:p-7">
      <Eyebrow>Health</Eyebrow>
      <dl className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <div>
              <dt className="text-[14.5px] font-semibold text-ink">{row.label}</dt>
              <dd className="m-0 mt-[2px] font-mono text-[11.5px] text-subtle-2">{row.note}</dd>
            </div>
            <dd
              className={cx(
                'display m-0 text-[26px] leading-none tabular-nums',
                row.n === 0 ? 'text-green-text' : 'text-coral-text',
              )}
            >
              {row.n}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-5 border-t-2 border-hairline pt-4 sm:grid-cols-2">
        <div>
          <SubHead>Scanner versions</SubHead>
          <ul className="m-0 mt-3 grid list-none gap-2 p-0">
            {health.scannerVersions.map((v) => (
              <li key={v.version} className="flex justify-between font-mono text-[12.5px]">
                <span className="text-ink">{v.version}</span>
                <span className="tabular-nums text-subtle-2">{v.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {/* A row still under an old scoring version is re-scorable, which is
              the whole reason every score records the version that made it. */}
          <SubHead>Scoring versions</SubHead>
          <ul className="m-0 mt-3 grid list-none gap-2 p-0">
            {health.scoringVersions.map((v) => (
              <li key={v.version} className="flex justify-between font-mono text-[12.5px]">
                <span className="text-ink">{v.version}</span>
                <span className="tabular-nums text-subtle-2">{v.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
