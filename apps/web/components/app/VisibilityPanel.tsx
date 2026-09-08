import Link from 'next/link';

import { Card, Eyebrow, cx } from '@/components/ui';
import { PRICING, upgradeHref, rung } from '@/lib/site';
import type { VisibilityView } from '@/lib/visibility-data';

/**
 * Share of voice, on the prompt watch page.
 *
 * Everything here is a count of citations in answers we recorded, which is why
 * the panel says so in its own subhead rather than in a footnote. The number
 * that would be worth more — whether an assistant thinks the customer is any
 * good — is not measurable, and constraint 8 is the reason we do not print a
 * model's opinion of a site as though it were a fact about the site.
 */
export function VisibilityPanel({ v, domain }: { v: VisibilityView; domain: string }) {
  const nothingAsked = v.now.runs === 0;
  const peak = Math.max(1, v.now.citations, ...v.now.rivals.map((r) => r.citations));

  return (
    <Card radius="panel" shadow={5} className="mt-6 p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Eyebrow>Share of voice</Eyebrow>
        <span className="font-mono text-[11.5px] text-subtle-2">
          {v.now.engines.length > 0 ? v.now.engines.join(' · ') : 'no engine has answered yet'} · last {v.windowDays} days
        </span>
      </div>

      {nothingAsked ? (
        <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.55] text-muted">
          Nothing has been asked yet, so there is nothing to report. Add a question above and run it, and this fills in
          with how often an assistant cited {domain} against the competitors you are tracking.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
            <Metric n={`${v.now.shareOfVoice}%`} label="share of tracked citations" strong />
            <Metric n={`${v.now.mentionRate}%`} label="of answers cited you" />
            <Metric n={v.now.averagePosition === null ? '—' : String(v.now.averagePosition)} label="average position" />
            <Metric n={`${v.now.citations}/${v.now.answered}`} label="answers citing you" />
          </div>

          {/* Refusals are excluded from both rates above. Said here rather
              than left to be discovered, because the alternative reading — an
              engine outage looking like a collapse — is the one that would
              send somebody chasing a problem that is ours. */}
          {v.now.runs > v.now.answered ? (
            <p className="mt-4 font-mono text-[11.5px] text-subtle-2">
              {v.now.runs - v.now.answered} of {v.now.runs} runs got no answer and are excluded from every rate above.
            </p>
          ) : null}

          <div className="mt-7 border-t-2 border-hairline pt-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">
              You against the domains you track
            </span>
            <div className="mt-4 grid gap-[11px]">
              <Row domain={domain} count={v.now.citations} share={v.now.shareOfVoice} peak={peak} self />
              {v.now.rivals.map((r) => (
                <Row key={r.domain} domain={r.domain} count={r.citations} share={r.shareOfVoice} peak={peak} />
              ))}
            </div>
            {v.rivals.length === 0 ? (
              <p className="mt-4 text-[13px] leading-[1.5] text-muted">
                You are not tracking anyone yet, so this is 100% by default rather than by result.{' '}
                <Link href={`/app/${domain}/competitors`}>Add the sites you compete with</Link> and it becomes a
                comparison.
              </p>
            ) : null}
          </div>

          {v.trend.some((w) => w.runs > 0) ? (
            <div className="mt-7 border-t-2 border-hairline pt-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-placeholder">Week by week</span>
              <div className="mt-4 flex h-[110px] items-end gap-3">
                {v.trend.map((w) => (
                  <div key={w.label} className="flex flex-1 flex-col items-center justify-end gap-[6px]">
                    <span className="font-mono text-[10.5px] text-subtle-2">{w.runs > 0 ? `${w.shareOfVoice}%` : ''}</span>
                    <span
                      className={cx('edge w-full rounded-t-[5px]', w.runs > 0 ? 'bg-violet' : 'bg-surface-alt')}
                      style={{ height: `${w.runs > 0 ? Math.max(3, (w.shareOfVoice / 100) * 76) : 3}px` }}
                      title={
                        w.runs > 0
                          ? `${w.label}: ${w.citations} of ${w.answered} answers cited you`
                          : `${w.label}: nothing asked`
                      }
                    />
                    <span className="font-mono text-[10px] text-placeholder">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Metric({ n, label, strong }: { n: string; label: string; strong?: boolean }) {
  return (
    <div>
      <div
        className={cx(
          'display text-[clamp(24px,3vw,36px)] leading-none tracking-[-0.03em]',
          strong ? 'text-violet' : 'text-ink',
        )}
      >
        {n}
      </div>
      <div className="mt-[7px] text-[13px] leading-[1.4] text-muted">{label}</div>
    </div>
  );
}

function Row({
  domain,
  count,
  share,
  peak,
  self,
}: {
  domain: string;
  count: number;
  share: number;
  peak: number;
  self?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(110px,1fr)_2fr_auto] items-center gap-3">
      <span className={cx('truncate font-mono text-[12.5px]', self ? 'font-bold text-ink' : 'text-body')} title={domain}>
        {domain}
      </span>
      <span>
        <span
          className={cx('edge block h-[14px] rounded-[5px]', self ? 'bg-violet' : 'bg-surface-alt')}
          style={{ width: `${Math.max(2, (count / peak) * 100)}%` }}
        />
      </span>
      <span className="w-[58px] text-right font-mono text-[12.5px] tabular-nums text-ink">{share}%</span>
    </div>
  );
}

/**
 * What the two plans below agency see instead.
 *
 * The upsell states the reason rather than the price: share of voice needs a
 * competitor set to have a denominator at all, and a competitor set is what
 * the tier above is for.
 */
export function VisibilityLocked({ domain }: { domain: string }) {
  const agency = rung('agency');
  return (
    <Card radius="panel" shadow={5} className="mt-6 p-6 sm:p-7">
      <Eyebrow>Share of voice</Eyebrow>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.55] text-muted">
        Your questions are being asked and every answer is recorded above. What the {agency.label} plan adds is the
        comparison: how often an assistant cited {domain} against the competitors you name, week by week, and where you
        sat in the list when it did.
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
