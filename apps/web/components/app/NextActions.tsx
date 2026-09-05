import Link from 'next/link';

import type { Effort, PunchItem } from '@botready/core';

import { cx } from '@/components/ui';

/**
 * What to do, in order.
 *
 * The overview showed a grade, five status codes and six category cards, and
 * not one of them was a thing anyone could go and do. The punch list has been
 * in the fix pack the whole time — every item is already phrased as an
 * instruction, already carries what it is worth and how long it takes, and
 * already knows which generated file does the work. It just was not on the
 * page anyone lands on.
 *
 * Five at most. A list of seventeen is a wall, and the seventeenth is worth
 * one point; the rest are one click away in All issues, which is what that
 * view is for.
 */
const EFFORT_LABEL: Record<Effort, string> = {
  minutes: 'minutes',
  hours: 'an hour or two',
  days: 'a day or more',
};

const SHOWN = 5;

export function NextActions({
  domain,
  punchList,
  projected,
  total,
}: {
  domain: string;
  punchList: PunchItem[];
  projected: { total: number; grade: string } | null;
  total: number | null;
}) {
  if (punchList.length === 0) return <AllClear domain={domain} />;

  const shown = punchList.slice(0, SHOWN);
  const rest = punchList.length - shown.length;
  const gain = projected && total !== null ? projected.total - total : 0;

  return (
    <section className="edge overflow-hidden rounded-[16px] bg-white shadow-hard-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink bg-lime-tint px-[22px] py-4">
        <h2 className="display text-[19px] font-semibold">Do this next</h2>
        <p className="m-0 font-mono text-[12.5px] text-body">
          {punchList.length} {punchList.length === 1 ? 'thing' : 'things'}
          {gain > 0 ? ` · all of it is worth +${gain} points` : ''}
        </p>
      </header>

      <ol className="m-0 list-none p-0">
        {shown.map((item, i) => (
          <li key={item.key} className={cx(i > 0 ? 'border-t border-hairline-2' : '')}>
            <Link
              href={item.file ? `/app/${domain}/editor` : `/app/${domain}/issues`}
              className="group flex items-start gap-[14px] px-[22px] py-[15px] no-underline transition-colors duration-150 hover:bg-surface-alt"
            >
              <span
                aria-hidden="true"
                className="edge mt-[1px] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-white font-mono text-[12px] font-bold text-ink"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-[15.5px] font-semibold text-ink group-hover:underline">{item.title}</span>
                <span className="mt-[3px] block text-[13.5px] leading-[1.5] text-muted">{item.rationale}</span>
                <span className="mt-[9px] flex flex-wrap items-center gap-[7px]">
                  {item.file ? (
                    <Tag tone="lime">in the pack · {item.file}</Tag>
                  ) : (
                    <Tag tone="plain">by hand · {item.owner}</Tag>
                  )}
                  <Tag tone="plain">{EFFORT_LABEL[item.effort]}</Tag>
                  {item.pointsRecovered > 0 ? <Tag tone="violet">+{Math.round(item.pointsRecovered)} pts</Tag> : null}
                </span>
              </span>
              <span aria-hidden="true" className="mt-[3px] shrink-0 font-mono text-[15px] text-placeholder group-hover:text-ink">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {rest > 0 ? (
        <p className="m-0 border-t-2 border-ink bg-surface-alt px-[22px] py-[13px] text-[13.5px] text-body">
          <Link href={`/app/${domain}/issues`}>
            {rest} smaller {rest === 1 ? 'one' : 'ones'} after these
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/**
 * Nothing failing. Still a list, because "you are done" is the one moment
 * where a person is most willing to do the next thing.
 */
function AllClear({ domain }: { domain: string }) {
  const next: Array<{ title: string; note: string; href: string }> = [
    {
      title: 'Re-run after your next deploy',
      note: 'A score is a measurement of one moment. A WAF rule or a framework upgrade can undo it without anyone touching the site.',
      href: `/app/${domain}/new`,
    },
    {
      title: 'Add a competitor',
      note: 'The same five clients, against the sites you are compared with. It is the only number here with a scale.',
      href: `/app/${domain}/competitors`,
    },
    {
      title: 'Watch a prompt',
      note: 'Ask an answer engine the question a buyer would, and record which domains it cites back.',
      href: `/app/${domain}/watch`,
    },
  ];

  return (
    <section className="edge overflow-hidden rounded-[16px] bg-white shadow-hard-4">
      <header className="border-b-2 border-ink bg-lime px-[22px] py-4">
        <h2 className="display text-[19px] font-semibold">Nothing to fix</h2>
        <p className="m-0 mt-1 text-[13.5px] leading-[1.5] text-ink">
          Every check passes. Here is what is worth doing anyway.
        </p>
      </header>
      <ol className="m-0 list-none p-0">
        {next.map((item, i) => (
          <li key={item.href} className={cx(i > 0 ? 'border-t border-hairline-2' : '')}>
            <Link
              href={item.href}
              className="group flex items-start gap-[14px] px-[22px] py-[15px] no-underline transition-colors duration-150 hover:bg-surface-alt"
            >
              <span
                aria-hidden="true"
                className="edge mt-[1px] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-white font-mono text-[12px] font-bold text-ink"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-[15.5px] font-semibold text-ink group-hover:underline">{item.title}</span>
                <span className="mt-[3px] block text-[13.5px] leading-[1.5] text-muted">{item.note}</span>
              </span>
              <span aria-hidden="true" className="mt-[3px] shrink-0 font-mono text-[15px] text-placeholder group-hover:text-ink">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tag({ tone, children }: { tone: 'lime' | 'violet' | 'plain'; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        'edge rounded-[7px] px-[8px] py-[2px] font-mono text-[11.5px] font-medium',
        tone === 'lime' ? 'bg-lime text-ink' : tone === 'violet' ? 'bg-violet text-white' : 'bg-white text-body',
      )}
    >
      {children}
    </span>
  );
}
