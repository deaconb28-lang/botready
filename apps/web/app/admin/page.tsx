import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

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
        <Activity m={m} />
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
          <Outcomes m={m} />
          <Health m={m} />
        </div>
      </Container>
    </div>
  );
}

function Stat({ n, label, tone }: { n: string | number; label: string; tone?: 'coral' | 'green' }) {
  return (
    <div>
      <div
        className={cx(
          'display text-[clamp(26px,3.2vw,38px)] leading-none tracking-[-0.03em]',
          tone === 'coral' ? 'text-coral-text' : tone === 'green' ? 'text-green-text' : 'text-ink',
        )}
      >
        {n}
      </div>
      <div className="mt-[7px] text-[13px] leading-[1.4] text-muted">{label}</div>
    </div>
  );
}

function Funnel({ m }: { m: AdminMetrics }) {
  const { funnel } = m;
  return (
    <Card radius="panel" shadow={5} className="mt-8 p-6 sm:p-7">
      <Eyebrow>The funnel</Eyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-5">
        <Stat n={funnel.scans} label="scans run, all time" />
        <Stat n={funnel.scored} label="produced a score" />
        <Stat n={funnel.packs} label="fix packs sold" tone="green" />
        <Stat n={funnel.subscriptions} label="live subscriptions" tone="green" />
        <Stat n={`${funnel.conversion}%`} label="scans that became a sale" />
      </div>
    </Card>
  );
}

function Activity({ m }: { m: AdminMetrics }) {
  const peak = Math.max(1, ...m.activity.daily.map((d) => d.count));
  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Scans, last fourteen days</Eyebrow>
        <span className="font-mono text-[12.5px] text-subtle-2">
          <span className="text-ink">{m.activity.last24h}</span> today ·{' '}
          <span className="text-ink">{m.activity.last7d}</span> this week
        </span>
      </div>
      {/* A bar per day including the empty ones, so a quiet week reads as a
          quiet week rather than as a short chart. */}
      <div className="mt-6 flex h-[120px] items-end gap-[6px]">
        {m.activity.daily.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-[6px]">
            <span className="font-mono text-[10px] text-subtle-2">{d.count || ''}</span>
            <span
              className="edge w-full rounded-t-[5px] bg-lime"
              style={{ height: `${Math.max(2, (d.count / peak) * 88)}px` }}
              title={`${d.day}: ${d.count}`}
            />
            <span className="font-mono text-[9.5px] text-placeholder">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
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
      <div className="mt-5 grid grid-cols-3 gap-4">
        <Stat n={outcomes.ranked} label="sites ranked" />
        <Stat n={outcomes.averageScore} label="average score" />
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

function Health({ m }: { m: AdminMetrics }) {
  const { health } = m;
  // Each of these should be zero. Colouring them by whether they are is the
  // whole reason the panel exists — a number nobody has a threshold for is a
  // number nobody acts on.
  const rows: Array<{ label: string; n: number; note: string }> = [
    { label: 'Unscored', n: health.unscored, note: 'complete, has evidence, no score row' },
    { label: 'Stuck', n: health.stuck, note: 'running for over an hour' },
    { label: 'Errored', n: health.errored, note: 'in the last 24 hours' },
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
      <div className="mt-6 border-t-2 border-hairline pt-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">
          Scanner versions in the table
        </span>
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          {health.scannerVersions.map((v) => (
            <li key={v.version} className="flex justify-between font-mono text-[12.5px]">
              <span className="text-ink">{v.version}</span>
              <span className="tabular-nums text-subtle-2">{v.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
