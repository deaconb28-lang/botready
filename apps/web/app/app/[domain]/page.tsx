import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain, type CategoryBreakdown } from '@botready/core';

import { RerunButton } from '@/components/app/RerunButton';
import { Bar, Card, DashConnector, cx } from '@/components/ui';
import { propertyFor, requireUser, ownsFixpack } from '@/lib/app-context';
import { PRICING } from '@/lib/site';
import { CLIENT_NAMES, relativeTime } from '@/lib/theme';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overview', robots: { index: false, follow: false } };

export default async function OverviewPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}`);
  const [p, owned] = await Promise.all([propertyFor(domain, user.id), ownsFixpack(user.id)]);
  if (!p) notFound();

  const agents = p.clients.filter((c) => c.id !== 'chrome');
  const refused = agents.filter((c) => !c.ok);
  const control = p.clients.find((c) => c.id === 'chrome');
  const jsRatio = Number(p.results.find((r) => r.key === 'js_dependency_ratio')?.observed.ratio ?? 0);
  const reached = p.clients.filter((c) => c.ok).length;
  const emptyBodies = p.clients.filter((c) => c.ok && jsRatio > 0.7).length;
  const healthy = p.score ? /^[AB]/.test(p.score.grade) : false;
  const fileCount = p.pack ? p.pack.files.length + 2 : 0;
  const packHref = p.scanId ? (owned ? `/api/fixpack/${p.scanId}` : `/api/checkout/${p.scanId}`) : '/pricing';

  const headline = !p.score
    ? p.status === 'blocked'
      ? 'Your site refuses our scanner too.'
      : 'No result yet.'
    : refused.length > 0
      ? 'Chrome gets the tour. The bots get bounced.'
      : jsRatio > 0.7
        ? 'Everyone gets in. Almost nobody gets the words.'
        : healthy
          ? 'Every client gets in and gets the words.'
          : 'Every client gets in. The rest is structure.';

  const summary = !p.score
    ? p.status === 'blocked'
      ? `We were refused as BotreadyBot and stopped there. Allow BotreadyBot at your edge and re-run the scan.`
      : `Run a scan and this page fills in with what each of the five clients got back.`
    : `We fetched ${p.domain} ${p.clients.length} times with ${p.clients.length} different user agents, ${relativeTime(p.finishedAt)}. ${
        reached === p.clients.length ? 'Every request' : `Only ${wordNumber(reached)} ${reached === 1 ? 'request' : 'requests'}`
      } reached your HTML${emptyBodies > 0 ? `, and ${emptyBodies === reached ? (reached === 1 ? 'it' : 'all of them') : wordNumber(emptyBodies)} got an empty body` : ''}.`;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[300px] flex-1">
          <h1 className="display-tight text-[clamp(28px,3.6vw,42px)] leading-[1.05]">{headline}</h1>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.55] text-body">{summary}</p>
        </div>
        <RerunButton domain={p.domain} next={`/app/${p.domain}`} />
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[18px]">
        <div className="edge max-w-[340px] overflow-hidden rounded-[14px] bg-white shadow-hard-4">
          {/* Ink on coral, white on green. The prototype drew the coral grade in
              white; at 2.80:1 that is below the floor even for 88px type, and
              the handoff's own rule says text on coral is always ink. */}
          <div className={cx('border-b-2 border-ink px-[22px] pb-5 pt-[30px] text-center', healthy ? 'bg-green' : 'bg-coral')}>
            <div className={cx('display-tight text-[88px] leading-[0.86] tracking-[-0.05em]', healthy ? 'text-white' : 'text-ink')}>
              {p.score?.grade ?? (p.status === 'blocked' ? '403' : '—')}
            </div>
            <div className={cx('mt-[14px] font-mono text-[14px] font-bold', healthy ? 'text-white' : 'text-ink')}>
              {p.score ? `${p.score.total} / 100` : p.status === 'blocked' ? 'refused' : 'no result'}
            </div>
          </div>
          <dl className="m-0 grid gap-[9px] px-5 py-[18px] font-mono text-[13.5px] text-body">
            <Line k="HTTP" v={control ? `${control.status === 0 ? 'no response' : control.status}` : '—'} />
            <Line k="grade" v={p.score?.grade ?? '—'} />
            <div className="flex items-center gap-2">
              <span>blocked:</span>
              <span className={cx('rounded-[5px] border-[1.5px] border-ink px-[7px] text-ink', refused.length > 0 ? 'bg-coral' : 'bg-lime')}>
                {refused.length} of {agents.length || '—'}
              </span>
            </div>
            <Line k="fixes" v={String(fileCount)} />
            <div className="text-subtle">prev: {p.previous ? `${p.previous.grade} (${p.previous.total})` : 'first run'}</div>
          </dl>
        </div>

        <Card radius="card" shadow={4} className="p-5">
          <div className="font-mono text-[12.5px] tracking-[0.1em] text-subtle uppercase">One request, five agents</div>
          {p.clients.length === 0 ? (
            <p className="mt-3 text-[14px] leading-[1.5] text-quiet">We did not get far enough to compare the clients.</p>
          ) : (
            <div className="mt-[14px] flex items-center gap-[14px]">
              <div className="edge flex-none rounded-[11px] bg-violet px-[11px] py-[13px] text-center font-mono text-[12.5px] font-medium leading-[1.5] text-white shadow-hard-2">
                GET /<br />×{p.clients.length}
              </div>
              <DashConnector color="#111318" width={26} />
              <ul className="m-0 grid min-w-0 flex-1 list-none gap-[9px] p-0">
                {p.clients.map((c) => {
                  const tone = c.ok ? (jsRatio > 0.7 && c.id !== 'chrome' ? 'warn' : 'ok') : 'bad';
                  return (
                    <li key={c.id} className="edge flex items-center gap-3 rounded-[11px] bg-white px-[13px] py-[9px]">
                      <span className={cx('edge whitespace-nowrap rounded-[7px] px-[9px] py-[2px] font-mono text-[12px] font-bold text-ink', tone === 'ok' ? 'bg-lime' : tone === 'warn' ? 'bg-amber' : 'bg-coral')}>
                        {c.status === 0 ? 'ERR' : c.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-medium">{CLIENT_NAMES[c.id] ?? c.id}</span>
                      <span className={cx('truncate font-mono text-[12.5px]', tone === 'ok' ? 'text-quiet' : tone === 'warn' ? 'text-amber-text' : 'text-coral-text')}>{c.note}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {p.score ? (
        <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-4">
          {p.score.categories.map((c) => (
            <CategoryCard key={c.key} category={c} note={noteFor(c, p.findings)} />
          ))}
        </div>
      ) : null}

      <Card surface="violet" radius="card" shadow={4} className="mt-[18px] flex flex-wrap items-center justify-between gap-[22px] px-7 py-[26px]">
        <p className="max-w-[58ch] font-body text-[16.5px] font-semibold leading-[1.5] text-white">
          Diagnosis is free. {fileCount > 0 ? `${wordNumber(fileCount, true)} generated files — robots rules, WAF rule, llms.txt, schema blocks and a coding-agent prompt — are ready to download.` : 'Run a scan and the fix pack is generated from it.'}
        </p>
        <a href={packHref} className="edge whitespace-nowrap rounded-[11px] bg-lime px-6 py-[14px] font-body text-[15.5px] font-bold text-ink no-underline shadow-hard-3 hover:bg-white">
          {owned ? 'Download the pack' : `Get the pack — ${PRICING.fixpack.label}`}
        </a>
      </Card>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div>
      {k === 'HTTP' ? `HTTP/2 ${v}` : `${k}: ${v}`}
    </div>
  );
}

function CategoryCard({ category, note }: { category: CategoryBreakdown; note: string }) {
  const solid = category.available > 0 && category.earned === 0;
  const tone = category.score < 50 ? 'bad' : category.score < 75 ? 'warn' : 'ok';
  const bar = solid ? '#FFFFFF' : tone === 'bad' ? '#FF6B5A' : tone === 'warn' ? '#FFCF5C' : '#C6F53C';
  return (
    <div className={cx('edge rounded-[14px] px-5 py-[18px] shadow-hard-3', solid ? 'bg-coral' : 'bg-white')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body text-[16px] font-bold">{category.label}</span>
        <span className={cx('font-mono text-[13.5px] font-medium', solid ? 'text-ink' : tone === 'bad' ? 'text-coral-text' : 'text-body')}>
          {category.earned}/{category.available}
        </span>
      </div>
      <Bar pct={category.score} color={bar} track={solid ? 'bg-white' : 'bg-canvas'} className="mb-[11px] mt-[13px]" label={`${category.label} ${category.score}%`} />
      <div className={cx('truncate font-mono text-[13px]', solid ? 'text-ink' : 'text-body')} title={note}>
        {note}
      </div>
    </div>
  );
}

function noteFor(category: CategoryBreakdown, findings: Array<{ category: string; headline: string; status: string }>): string {
  const mine = findings.filter((f) => f.category === category.key);
  if (mine.length === 0) return category.available === 0 ? 'nothing to measure here' : `all ${category.checks.length} checks pass`;
  const worst = mine[0];
  return worst ? lower(worst.headline) : `${mine.length} failing`;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function wordNumber(n: number, capital = false): string {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
  return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}
