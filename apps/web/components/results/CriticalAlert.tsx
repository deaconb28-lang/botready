import type { Finding } from '@botready/core';

import { cx } from '@/components/ui';

/**
 * What a critical failure costs, above the score rather than below it.
 *
 * A site can fail one of these and still read as a C, because the total is an
 * average and a refusal to two clients out of five leaves three categories
 * intact. That average is honest and it is also, on its own, misleading: the
 * one number cannot say that the thing which failed is the thing the other
 * numbers were measured on top of.
 *
 * So it is stated as what is being lost rather than what is scored. Not a
 * scare — every sentence below is the plain consequence of the observation
 * that produced it, and the evidence is a click away in the findings.
 */

const LOSS: Record<string, string> = {
  agent_status_parity:
    'When somebody asks an assistant about you, it answers from whatever it can reach. That is not your site.',
  js_dependency_ratio:
    'These clients do not run JavaScript. They are being handed an empty page and answering from somewhere else.',
  robots_agent_rules:
    'Your own robots.txt is what turns them away. Nothing else on the site gets a chance to be read.',
};

export function CriticalAlert({ keys, findings }: { keys: string[]; findings: Finding[] }) {
  if (keys.length === 0) return null;

  const items = keys
    .map((key) => ({ key, finding: findings.find((f) => f.key === key) }))
    .filter((item): item is { key: string; finding: Finding } => Boolean(item.finding));

  if (items.length === 0) return null;

  return (
    <section
      role="alert"
      className="edge mt-[18px] overflow-hidden rounded-[18px] bg-coral-tint shadow-hard-4"
    >
      <div className="flex items-center gap-3 border-b-2 border-ink bg-coral px-[18px] py-[10px]">
        <WarningMark />
        <h2 className="display text-[15px] font-semibold text-ink">
          {items.length === 1 ? 'One thing is costing you the rest' : `${items.length} things are costing you the rest`}
        </h2>
      </div>
      <ul className="m-0 list-none p-0">
        {items.map((item, i) => (
          <li key={item.key} className={cx('px-[18px] py-[13px]', i > 0 && 'border-t border-ink/15')}>
            <p className="display m-0 text-[15px] font-semibold text-ink">{item.finding.headline}</p>
            <p className="m-0 mt-[3px] text-[14px] leading-[1.5] text-ink">
              {LOSS[item.key] ?? item.finding.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A triangle, drawn rather than set, so it needs no font and no emoji. */
function WarningMark() {
  return (
    <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-ink bg-white">
      <svg viewBox="0 0 20 20" className="h-[13px] w-[13px]">
        <path d="M10 3.2 18.2 17H1.8Z" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 8.4v3.4" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="14.3" r="1" fill="var(--color-ink)" />
      </svg>
    </span>
  );
}
