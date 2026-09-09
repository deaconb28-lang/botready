import { DIVERGENCE_REMEDY, type AgentVerdict, type DivergenceClass, type DivergenceVerdict } from '@botready/core';

import { cx } from '@/components/ui';

/**
 * Who got the page and who did not, above the score.
 *
 * This is the finding the product exists for and it has been a table near the
 * bottom of the page. A reader had to collect five status codes and notice
 * that one of them was different, which is work we can do for them — and the
 * sentence it produces is the one that travels: "Three of four AI clients were
 * refused. Chrome was not."
 *
 * Above the score because the score is an average. A site refusing three
 * clients out of four still has four intact categories underneath, so the
 * total comes out a C and reads as "could be better" rather than as "an
 * assistant asked about you is answering from somewhere else".
 *
 * The five codes are shown side by side rather than summarised, because the
 * shape of the row is the evidence. Chrome 200 next to ClaudeBot 403 is an
 * argument; "3 clients blocked" is a claim.
 *
 * Renders nothing when there is nothing to say — every client served, or a
 * control that never worked so there is no baseline. The verdict decides that,
 * not this component: see divergence.ts.
 */

/** Ink on lime, ink on amber, ink on coral — the same mapping as everywhere. */
const TONE: Record<DivergenceClass, { chip: string; dot: string; word: string }> = {
  served: { chip: 'bg-lime text-ink', dot: 'bg-green', word: 'served' },
  soft_404: { chip: 'bg-coral text-ink', dot: 'bg-coral', word: 'told it does not exist' },
  waf_challenge: { chip: 'bg-coral text-ink', dot: 'bg-coral', word: 'challenged' },
  waf_403: { chip: 'bg-coral text-ink', dot: 'bg-coral', word: 'refused' },
  rate_limited: { chip: 'bg-amber text-ink', dot: 'bg-amber', word: 'rate limited' },
  origin_shed: { chip: 'bg-amber text-ink', dot: 'bg-amber', word: 'server error' },
  unreachable: { chip: 'bg-surface-alt text-subtle-2', dot: 'bg-hairline-3', word: 'no answer' },
  other: { chip: 'bg-amber text-ink', dot: 'bg-amber', word: 'not readable' },
};

export function DivergencePanel({ v }: { v: DivergenceVerdict }) {
  if (!v.headline) return null;

  // The remedies worth printing: one line per distinct problem, not per
  // client. Four clients behind one firewall rule is one thing to fix.
  const classes = [...new Set(v.refused.map((a) => a.klass))].filter((k) => k !== 'unreachable');

  return (
    <section
      className={cx(
        'edge mt-6 rounded-[20px] p-6 shadow-hard-5 sm:p-7',
        // Coral for a differential, because somebody is being turned away that
        // a browser is not. Amber when everyone is refused: still bad, but not
        // this finding, and colouring it the same would overstate it.
        v.differential ? 'bg-coral-tint' : 'bg-amber-tint',
      )}
      aria-labelledby="divergence"
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-2">
        What each client got, same URL, same second
      </span>
      <h2 id="divergence" className="display-tight mt-[10px] max-w-[46ch] text-[clamp(21px,2.6vw,30px)]">
        {v.headline}
      </h2>

      {/* The row is the evidence. Scrolls rather than wraps: five codes in a
          line is the shape somebody screenshots, and a wrapped grid is not. */}
      <div className="mt-6 -mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-3">
          {v.agents.map((a) => (
            <Client key={a.agentId} a={a} />
          ))}
        </div>
      </div>

      {v.disallowed.length > 0 ? (
        <p className="mt-5 text-[13.5px] leading-[1.55] text-body">
          Your robots.txt also asks {v.disallowed.map((a) => a.label).join(', ')} not to come — which is a separate line to
          change from whatever your edge is doing.
        </p>
      ) : null}

      {classes.length > 0 ? (
        <ul className="m-0 mt-5 grid list-none gap-[9px] border-t-2 border-hairline-4 p-0 pt-5">
          {classes.map((k) => (
            <li key={k} className="grid grid-cols-[auto_1fr] items-baseline gap-[10px]">
              <span className={cx('edge rounded-[99px] px-[8px] py-[2px] font-mono text-[9.5px] uppercase tracking-[0.08em]', TONE[k].chip)}>
                {TONE[k].word}
              </span>
              <span className="text-[13.5px] leading-[1.55] text-body">{DIVERGENCE_REMEDY[k]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Client({ a }: { a: AgentVerdict }) {
  const tone = TONE[a.klass];
  return (
    <div
      className={cx(
        'edge w-[124px] flex-none rounded-[14px] bg-white p-3 text-center',
        a.isControl ? 'shadow-hard-3' : '',
      )}
    >
      <div className="font-mono text-[10.5px] text-placeholder">{a.isControl ? 'browser' : 'AI client'}</div>
      <div className="mt-[6px] truncate font-body text-[13.5px] font-semibold text-ink" title={a.label}>
        {a.label}
      </div>
      <div
        className={cx(
          'edge mt-[9px] rounded-[9px] py-[5px] font-mono text-[15px] tabular-nums',
          tone.chip,
        )}
      >
        {a.status === 0 ? '—' : a.status}
      </div>
      {/* The word as well as the colour: state never rests on colour alone. */}
      <div className="mt-[7px] text-[11.5px] leading-[1.3] text-muted">{tone.word}</div>
    </div>
  );
}
