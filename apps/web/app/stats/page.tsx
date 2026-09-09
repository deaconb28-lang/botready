import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow, PageTitle, ThinBar, cx } from '@/components/ui';
import { PROSE_LINK } from '@/components/blog/prose';
import { pageMetadata } from '@/lib/metadata';
import { asymmetryShare, loadPublicStats, type ClientRate, type PublicStats } from '@/lib/stats-data';

export const metadata: Metadata = pageMetadata('/stats');

/**
 * What the corpus says, recomputed on every request.
 *
 * The category's public numbers are round and unsourced. Ours are aggregates
 * over scans people asked for, so every one of them carries the count it was
 * taken over and a sentence saying what it counted. That is the only thing
 * that makes a statistics page worth more than a blog post: a reader can
 * disagree with the definition.
 *
 * Dynamic rather than revalidated, because the numbers move as scans arrive
 * and a stale figure with a date on it is worse than a fresh one with a
 * request cost. There is no personal data on this page and nothing that
 * identifies a site: every figure is a count or a rate.
 */
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const stats = await loadPublicStats();

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <Container width={1080} className="pb-24 pt-11">
          <PageTitle
            eyebrow="Measured, not estimated"
            size="xl"
            lede="Every number on this page is an aggregate over scans somebody asked for. Each one carries the count it was taken over, and says what it counted. Nothing here is modelled, sampled or bought."
          >
            What we have measured so far
          </PageTitle>

          <Nothing stats={stats} />
          <Outcomes stats={stats} />
          <Clients stats={stats} />
          <AsymmetryPanel stats={stats} />
          <Checks stats={stats} />
          <Profiles stats={stats} />

          <p className="mt-8 max-w-[70ch] text-[13.5px] leading-[1.6] text-quiet">
            Read at {stats.readAt.slice(0, 16).replace('T', ' ')} UTC, from the scan record. A scan enters this page the
            moment it settles, so the figures move. If one of them disagrees with something we have said elsewhere, this
            page is the one that is current.{' '}
            <Link href="/what-we-check" className={PROSE_LINK}>
              Every check and weight is published
            </Link>
            , so a rate here can be traced to the rule that produced it.
          </p>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * When not one aggregate came back.
 *
 * Which is a different thing from "we have measured nothing", and the page
 * should not imply the second when it means the first. Says which it is only
 * as far as it can honestly tell, and does not invent a reason.
 */
function Nothing({ stats }: { stats: PublicStats }) {
  const empty =
    !stats.outcomes && !stats.asymmetry && stats.clients.length === 0 && stats.checks.length === 0;
  if (!empty) return null;
  return (
    <Card radius="panel" shadow={5} className="mt-8 p-6 sm:p-7">
      <Eyebrow>Nothing to show</Eyebrow>
      <p className="mt-4 max-w-[68ch] text-[15px] leading-[1.6] text-muted">
        We could not read the scan record just now, so rather than print figures we are not sure of, this page is
        showing none. Nothing has been lost — try again shortly, or{' '}
        <Link href="/what-we-check" className={PROSE_LINK}>
          read what each of these numbers counts
        </Link>{' '}
        in the meantime.
      </p>
    </Card>
  );
}

function Outcomes({ stats }: { stats: PublicStats }) {
  const o = stats.outcomes;
  if (!o) return null;
  return (
    <Card radius="panel" shadow={5} className="mt-8 p-6 sm:p-7">
      <Eyebrow>Every scan we have settled</Eyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
        <Metric n={o.scans} label="scans settled" />
        <Metric n={o.complete} label="scored" tone="green" />
        <Metric n={o.blocked} label="refused our scanner" tone={o.blocked > 0 ? 'coral' : undefined} />
        <Metric n={`${o.blockedPct}%`} label="of settled scans were refused" />
      </div>
      <p className="mt-6 max-w-[74ch] border-t-2 border-hairline pt-4 text-[13.5px] leading-[1.55] text-muted">
        Refused means the site answered <span className="font-mono text-[12.5px]">BotreadyBot/1.0</span> with a 401, 403
        or 429 on the first request, and we stopped there rather than working around it. Those scans never reach a score,
        so they are absent from every figure below — which is worth knowing, because it means the scores on this page are
        the scores of sites that let us read them.
      </p>
    </Card>
  );
}

function Clients({ stats }: { stats: PublicStats }) {
  if (stats.clients.length === 0) return null;
  const worst = Math.max(1, ...stats.clients.map((c) => c.refusedPct));
  const control = stats.clients.find((c) => c.isControl);
  const agents = stats.clients.filter((c) => !c.isControl);
  const topAgent = [...agents].sort((a, b) => b.refusedPct - a.refusedPct)[0];

  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Refusal rate by client</Eyebrow>
        <span className="font-mono text-[11.5px] text-subtle-2">
          same URL, same second, {stats.clients[0]?.asked.toLocaleString('en-US')} scans each
        </span>
      </div>

      {control && topAgent ? (
        <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.55] text-ink">
          {topAgent.label} is refused on {topAgent.refusedPct}% of the sites we have scanned. A browser asking for the
          same URL in the same second is refused on {control.refusedPct}%.
        </p>
      ) : null}

      <div className="mt-6 grid gap-[13px]">
        {stats.clients.map((c) => (
          <ClientRow key={c.agentId} c={c} peak={worst} />
        ))}
      </div>

      <p className="mt-6 max-w-[74ch] border-t-2 border-hairline pt-4 text-[13.5px] leading-[1.55] text-muted">
        Refused counts a 4xx or a 5xx. A request that produced no response at all is not counted as a refusal in either
        direction — nothing was measured — so the percentages are over the scans where that client got an answer. Every
        client is sent the same URL from the same address within a second of the others, which is what makes the
        comparison a comparison.
      </p>
    </Card>
  );
}

function ClientRow({ c, peak }: { c: ClientRate; peak: number }) {
  return (
    <div className="grid grid-cols-[minmax(120px,1.1fr)_2fr_auto] items-center gap-3">
      <div className="min-w-0">
        <div className="truncate font-body text-[14px] font-semibold text-ink">{c.label}</div>
        <div className="font-mono text-[10.5px] text-placeholder">{c.isControl ? 'browser control' : 'AI client'}</div>
      </div>
      <ThinBar
        pct={(c.refusedPct / peak) * 100}
        color={c.isControl ? 'var(--color-green)' : 'var(--color-coral)'}
      />
      <span className="w-[112px] text-right font-mono text-[12.5px] tabular-nums text-ink">
        {c.refusedPct}% <span className="text-subtle-2">of {c.asked}</span>
      </span>
    </div>
  );
}

/**
 * The one statistic worth a headline.
 *
 * A site that lets Google's agent crawler in while refusing the others has
 * made a decision about search traffic, and almost certainly not a decision
 * about the other three. Recomputed over the whole corpus rather than quoted
 * from the sweep that found it, and stated as a fraction of the divergent
 * sites rather than of all sites, because that is the population the claim is
 * about.
 */
function AsymmetryPanel({ stats }: { stats: PublicStats }) {
  const a = stats.asymmetry;
  const pct = asymmetryShare(a);
  if (!a || pct === null) return null;

  return (
    <Card surface="violet" radius="panel" shadow={7} className="mt-5 p-6 sm:p-8">
      <Eyebrow tone="on-violet">The Google-Extended asymmetry</Eyebrow>
      <p className="display mt-4 max-w-[40ch] text-[clamp(24px,3.2vw,38px)] leading-[1.06] tracking-[-0.03em] text-white">
        {pct}% of the sites that block an AI client let Google&rsquo;s through.
      </p>
      <p className="mt-4 max-w-[64ch] text-[15.5px] leading-[1.6] text-on-violet">
        Of {a.divergent} sites that served a browser and refused at least one AI client,{' '}
        {a.googleAllowedOthersNot} served Google-Extended anyway. It has an obvious explanation — nobody wants to risk
        their search traffic — and it is worth noticing that the risk is the same for all four: none of these crawlers
        is the one that ranks you.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t-2 border-white/20 pt-5 sm:grid-cols-4">
        <Metric n={a.scans} label="scans with a client table" on="violet" />
        <Metric n={a.browserServed} label="served a browser" on="violet" />
        <Metric n={a.divergent} label="refused an AI client anyway" on="violet" />
        <Metric n={a.googleAllowedOthersNot} label="but not Google-Extended" on="violet" />
      </div>
    </Card>
  );
}

function Checks({ stats }: { stats: PublicStats }) {
  if (stats.checks.length === 0) return null;
  const top = stats.checks.slice(0, 10);
  const peak = Math.max(1, ...top.map((c) => c.failedPct));

  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>What sites fail most</Eyebrow>
        <span className="font-mono text-[11.5px] text-subtle-2">worst ten, of the scans that ran each check</span>
      </div>
      <div className="mt-5 grid gap-[13px]">
        {top.map((c) => (
          <div key={c.key} className="grid grid-cols-[minmax(160px,1.4fr)_2fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] leading-[1.35] text-ink" title={c.label}>
                {c.label}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-placeholder">{c.category}</div>
            </div>
            <ThinBar pct={(c.failedPct / peak) * 100} color="var(--color-coral)" />
            <span className="w-[112px] text-right font-mono text-[12.5px] tabular-nums text-ink">
              {c.failedPct}% <span className="text-subtle-2">of {c.ran}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-[74ch] border-t-2 border-hairline pt-4 text-[13.5px] leading-[1.55] text-muted">
        A check that could not run is counted apart from one a site failed: folding a timeout of ours into a failure
        rate would blame a site for our own problem. Skipped checks — the ones a sector is not measured on — leave the
        denominator entirely, so a rate here is over the sites the check was actually asked of.
      </p>
    </Card>
  );
}

function Profiles({ stats }: { stats: PublicStats }) {
  if (stats.profiles.length === 0) {
    return (
      <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
        <Eyebrow>Scores by kind of site</Eyebrow>
        <p className="mt-4 max-w-[68ch] text-[14.5px] leading-[1.6] text-muted">
          Nothing to show yet. A median has to be taken within one scoring version, or it averages totals built from
          different check catalogs, and the current catalog shipped recently enough that no cohort has filled up. This
          fills in as scans arrive rather than being backfilled, because re-scoring history is a decision and not a
          side effect.
        </p>
      </Card>
    );
  }

  return (
    <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Scores by kind of site</Eyebrow>
        <span className="font-mono text-[11.5px] text-subtle-2">median, within one scoring version</span>
      </div>
      <div className="mt-5 grid gap-[11px]">
        {stats.profiles.map((p) => (
          <div key={`${p.profile}-${p.scoringVersion}`} className="grid grid-cols-[minmax(120px,1fr)_auto] items-baseline gap-4">
            <span className="font-mono text-[13px] text-ink">
              {p.profile} <span className="text-subtle-2">v{p.scoringVersion}</span>
            </span>
            <span className="font-mono text-[12.5px] tabular-nums text-body">
              median {p.median} · {p.worst}&ndash;{p.best} · {p.scored} sites
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-[74ch] border-t-2 border-hairline pt-4 text-[13.5px] leading-[1.55] text-muted">
        Grouped by the profile a site was scored under, because the profile decides which checks were counted. A median
        across mixed profiles averages numbers built from different denominators, which reads like a comparison and is
        not one.
      </p>
    </Card>
  );
}

function Metric({
  n,
  label,
  tone,
  on,
}: {
  n: number | string;
  label: string;
  tone?: 'green' | 'coral';
  on?: 'violet';
}) {
  return (
    <div>
      <div
        className={cx(
          'display text-[clamp(24px,3vw,34px)] leading-none tracking-[-0.03em]',
          on === 'violet'
            ? 'text-white'
            : tone === 'green'
              ? 'text-green-text'
              : tone === 'coral'
                ? 'text-coral-text'
                : 'text-ink',
        )}
      >
        {typeof n === 'number' ? n.toLocaleString('en-US') : n}
      </div>
      <div className={cx('mt-[7px] text-[13px] leading-[1.4]', on === 'violet' ? 'text-on-violet' : 'text-muted')}>
        {label}
      </div>
    </div>
  );
}
