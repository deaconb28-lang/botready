import { Card, Eyebrow, TerminalLine, cx } from '@/components/ui';
import { PRICING, SITE, rung, upgradeHref } from '@/lib/site';
import type { CrawlerView } from '@/lib/crawler-data';

/**
 * What actually fetched this site.
 *
 * The four verdicts are kept apart everywhere on this page, including in the
 * headline number, and that is the entire product rather than a detail of it.
 * Every other tool in this category counts user-agent strings and calls the
 * total crawler traffic. A user-agent is a claim anybody can type, so that
 * total is wrong in the flattering direction: a customer reads it as "the AI
 * crawlers found me" and stops looking.
 *
 * So there is no single big number here. There is a verified number, an
 * unverified number and a forged number, and the copy says which is which.
 */
export function CrawlersPanel({ v, domain }: { v: CrawlerView; domain: string }) {
  if (!v.receiving) return <Setup v={v} domain={domain} />;

  const peak = Math.max(1, ...v.daily.map((d) => d.verified + d.unverified + d.forged));

  return (
    <>
      <Card radius="panel" shadow={5} className="mt-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Eyebrow>Who fetched you</Eyebrow>
          <span className="font-mono text-[11.5px] text-subtle-2">last {v.windowDays} days · from your own logs</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
          <Metric n={v.totals.verified} label="verified fetches" tone="green" />
          <Metric n={v.totals.unverified} label="claimed, unproven" />
          <Metric n={v.totals.forged} label="proven fake" tone={v.totals.forged > 0 ? 'coral' : undefined} />
          <Metric n={v.totals.refused} label="verified and refused" tone={v.totals.refused > 0 ? 'coral' : undefined} />
        </div>

        <p className="mt-6 max-w-[74ch] border-t-2 border-hairline pt-4 text-[13.5px] leading-[1.55] text-muted">
          A user-agent string is a claim, so these are three different numbers rather than one.{' '}
          <strong className="font-semibold text-ink">Verified</strong> means the address passed forward-confirmed
          reverse DNS or sits in a range the vendor publishes.{' '}
          <strong className="font-semibold text-ink">Proven fake</strong> means the vendor&rsquo;s own published
          evidence says it was not them. Everything in the middle is a claim we could not check, and it is never counted
          as the crawler it says it is.
        </p>

        {v.totals.forged > 0 ? (
          <p className="mt-4 text-[14px] leading-[1.55] text-ink">
            {share(v.totals.forged, v.totals.hits)}% of the AI crawler traffic in your logs was not the crawler it
            claimed to be.
          </p>
        ) : null}
        {v.totals.refused > 0 ? (
          <p className="mt-2 text-[14px] leading-[1.55] text-coral-text">
            {v.totals.refused} verified fetches were refused with a 401, 403 or 429. That is a real crawler being turned
            away, seen from the other side of the scan.
          </p>
        ) : null}
      </Card>

      <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
        <Eyebrow>By crawler</Eyebrow>
        <div className="mt-5 grid gap-[13px]">
          {v.agents.map((a) => (
            <div key={a.agentId} className="grid grid-cols-[minmax(130px,1.2fr)_2fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-[12.5px] text-ink">{a.label}</div>
                <div className="truncate font-mono text-[10.5px] text-placeholder">
                  {a.vendor} · {a.purpose}
                </div>
              </div>
              {/* Three segments rather than one bar, so a crawler that is
                  mostly unproven cannot read as a crawler that mostly came. */}
              <div className="flex h-[14px] w-full overflow-hidden rounded-[5px]" style={{ border: '2px solid #111318' }}>
                <Seg n={a.verified} of={peakOf(v)} className="bg-lime" title={`${a.verified} verified`} />
                <Seg n={a.unverified} of={peakOf(v)} className="bg-surface-alt" title={`${a.unverified} unverified`} />
                <Seg n={a.forged} of={peakOf(v)} className="bg-coral" title={`${a.forged} forged`} />
              </div>
              <span className="w-[64px] text-right font-mono text-[12.5px] tabular-nums text-ink">{a.hits}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-4 font-mono text-[11px] text-subtle-2">
          <Key colour="bg-lime" label="verified" />
          <Key colour="bg-surface-alt" label="unverified" />
          <Key colour="bg-coral" label="proven fake" />
        </div>
      </Card>

      <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
        <Eyebrow>Day by day</Eyebrow>
        <div className="mt-6 flex h-[120px] items-end gap-[3px]">
          {v.daily.map((d) => {
            const total = d.verified + d.unverified + d.forged;
            const h = (n: number) => (total === 0 ? 0 : Math.max(n > 0 ? 2 : 0, (n / peak) * 88));
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-[5px]">
                <span
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]"
                  style={{ border: total > 0 ? '2px solid #111318' : 'none' }}
                  title={`${d.day}: ${d.verified} verified, ${d.unverified} unverified, ${d.forged} forged`}
                >
                  <span className="block w-full bg-lime" style={{ height: `${h(d.verified)}px` }} />
                  <span className="block w-full bg-surface-alt" style={{ height: `${h(d.unverified)}px` }} />
                  <span className="block w-full bg-coral" style={{ height: `${h(d.forged)}px` }} />
                </span>
                <span className="font-mono text-[8.5px] text-placeholder">{d.day.slice(8)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {v.referrals.length > 0 ? (
        <Card radius="panel" shadow={5} className="mt-5 p-6 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <Eyebrow>People an assistant sent</Eyebrow>
            <span className="font-mono text-[11.5px] text-subtle-2">counts only — we store nothing about them</span>
          </div>
          <div className="mt-5 grid gap-[11px]">
            {v.referrals.map((r) => (
              <div key={r.surface} className="flex items-center justify-between gap-4">
                <span className="font-mono text-[12.5px] text-ink">{r.surface}</span>
                <span className="font-mono text-[12.5px] tabular-nums text-body">{r.visits}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function peakOf(v: CrawlerView): number {
  return Math.max(1, ...v.agents.map((a) => a.hits));
}

function Seg({ n, of, className, title }: { n: number; of: number; className: string; title: string }) {
  if (n === 0) return null;
  return <span className={cx('block h-full', className)} style={{ width: `${(n / of) * 100}%` }} title={title} />;
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className={cx('edge inline-block h-[10px] w-[10px] rounded-[3px]', colour)} />
      {label}
    </span>
  );
}

function Metric({ n, label, tone }: { n: number; label: string; tone?: 'green' | 'coral' }) {
  return (
    <div>
      <div
        className={cx(
          'display text-[clamp(24px,3vw,36px)] leading-none tracking-[-0.03em]',
          tone === 'green' ? 'text-green-text' : tone === 'coral' ? 'text-coral-text' : 'text-ink',
        )}
      >
        {n.toLocaleString('en-US')}
      </div>
      <div className="mt-[7px] text-[13px] leading-[1.4] text-muted">{label}</div>
    </div>
  );
}

function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Before any logs have arrived. The whole feature is inert until they do. */
function Setup({ v, domain }: { v: CrawlerView; domain: string }) {
  return (
    <Card radius="panel" shadow={5} className="mt-6 p-6 sm:p-7">
      <Eyebrow>Nothing has arrived yet</Eyebrow>
      <p className="mt-4 max-w-[68ch] text-[15px] leading-[1.55] text-muted">
        The scan tells you what a crawler <em>would</em> get. This tells you which ones actually came, and whether they
        were who they said they were. It reads your own access logs, so it needs you to point them here.
      </p>

      <div className="mt-6 border-t-2 border-hairline pt-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">Your endpoint</span>
        <TerminalLine className="mt-3">POST {SITE.origin}/api/collect</TerminalLine>
        <p className="mt-3 text-[13.5px] leading-[1.55] text-muted">
          Send <span className="font-mono text-[12.5px]">{`{ "hits": [ { ts, ip, ua, path, status } ] }`}</span> with
          your key in an <span className="font-mono text-[12.5px]">x-botready-key</span> header. A Vercel log drain
          works as-is; point one at that URL and nothing else is needed.
        </p>
      </div>

      <div className="mt-6 border-t-2 border-hairline pt-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">Your key</span>
        {v.key ? (
          <p className="mt-3 font-mono text-[13px] text-body">
            {v.key.hint} · {v.key.lastUsedAt ? `last used ${v.key.lastUsedAt.slice(0, 10)}` : 'never used'}
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] leading-[1.55] text-muted">
            You do not have one yet. Generate it from settings; it is shown once and stored only as a hash, so a leak of
            our database is not a leak of your key.
          </p>
        )}
      </div>

      {/* Said before they turn it on rather than in a policy nobody opens. */}
      <p className="mt-6 max-w-[68ch] border-t-2 border-hairline pt-5 text-[13px] leading-[1.55] text-subtle-2">
        What we keep: which crawler fetched which path, when, what status it got, and whether we could prove its
        identity. What we never write: a visitor&rsquo;s IP address, in any form, hashed or otherwise. A crawler&rsquo;s
        address exists only long enough to ask DNS whether the claim is true, and the verdict is what gets stored.
        There is no column in this database to put a person&rsquo;s address in.
      </p>
    </Card>
  );
}

/** What the plans below agency see. */
export function CrawlersLocked({ domain }: { domain: string }) {
  const agency = rung('agency');
  return (
    <Card radius="panel" shadow={5} className="mt-6 p-6 sm:p-7">
      <Eyebrow>Who fetched you</Eyebrow>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.55] text-muted">
        Your scan says what a crawler would get from {domain}. This says which ones actually came — and how many of
        them were really the crawler they claimed to be, which is the number nobody else in this category reports at
        all. It reads your own access logs, and it is part of the {agency.label} plan.
      </p>
      <a
        href={upgradeHref(agency)}
        className="edge mt-5 inline-block rounded-[12px] bg-lime px-[22px] py-[13px] font-body text-[14.5px] font-bold text-ink no-underline shadow-hard-3 transition-colors duration-150 hover:bg-white"
      >
        Move to {agency.label} — {PRICING.agency.label} {PRICING.agency.cadence}
      </a>
    </Card>
  );
}
