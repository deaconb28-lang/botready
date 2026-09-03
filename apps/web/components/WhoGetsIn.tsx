/**
 * "Who gets in": five clients, one URL, one second. The headline on every
 * screen, and the table that has to stay above the fold on mobile.
 *
 * Reads the parity check's observed facts and nothing else, so what it shows is
 * exactly what was measured.
 */

import { catalog, type CheckResult, type PerAgentFetch } from '@botready/core';

import { Card, CardHeading, Microcopy, StatusPill } from './primitives';

/** A short name for each client. The full user agent is in the evidence block. */
const SHORT_NAMES: Record<string, string> = {
  chrome: 'Chrome 141',
  claudebot: 'ClaudeBot/1.0',
  gptbot: 'GPTBot/1.2',
  perplexity: 'PerplexityBot',
  googleext: 'Google-Extended',
};

export function WhoGetsIn({ results }: { results: CheckResult[] }) {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;

  if (Object.keys(perAgent).length === 0) {
    return (
      <Card>
        <CardHeading>Who gets in</CardHeading>
        <Microcopy>
          We did not get far enough to compare the clients. Nothing below is implied about your
          site.
        </Microcopy>
      </Card>
    );
  }

  return (
    <Card as="section" className="flex flex-col">
      <CardHeading>Who gets in</CardHeading>

      <table className="w-full border-collapse">
        <caption className="sr-only">
          The HTTP status each client received for the same URL
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {catalog.agents.map((agent, index) => {
            const fact = perAgent[agent.id];
            const last = index === catalog.agents.length - 1;
            return (
              <tr
                key={agent.id}
                className={last ? '' : 'border-b border-dashed border-rule'}
              >
                <th
                  scope="row"
                  className="py-[9px] pr-3 text-left font-data text-[13px] font-normal"
                >
                  {SHORT_NAMES[agent.id] ?? agent.id}
                  {agent.role === 'control' ? (
                    <span className="ml-2 text-micro text-ink-60">control</span>
                  ) : null}
                </th>
                <td className="py-[9px] text-right">
                  {fact ? (
                    <StatusPill
                      status={fact.status}
                      {...(fact.transport_error ? { label: 'no reply' } : {})}
                    />
                  ) : (
                    <span className="font-data text-[11.5px] text-ink-60">not asked</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Microcopy className="mt-3.5">Same URL, same second, five clients.</Microcopy>
    </Card>
  );
}

/**
 * The two-readers split, filled in with a scan's real numbers. Same component
 * as the landing hero, different data: on the landing page it is an example and
 * says so, and here it is the measurement.
 */
export function readerSidesFrom(results: CheckResult[]) {
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');
  const parity = results.find((r) => r.key === 'agent_status_parity');
  if (!ratio) return null;

  const raw = Number(ratio.observed.raw_chars ?? 0);
  const rendered = Number(ratio.observed.rendered_chars ?? 0);
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const control = perAgent[String(parity?.observed.control ?? 'chrome')];

  return {
    left: {
      heading: 'What a browser gets',
      who: 'after rendering',
      chars: rendered,
      status: control?.status ?? 200,
      verdict: `${control?.status ?? 200} · ${rendered.toLocaleString('en-US')} readable characters`,
    },
    right: {
      heading: 'What a plain fetch gets',
      who: 'BotreadyBot/1.0',
      chars: raw,
      status: raw > 0 ? 200 : 403,
      verdict:
        raw === 0
          ? 'nothing readable'
          : `${raw.toLocaleString('en-US')} readable characters · ${Math.round(
              Number(ratio.observed.ratio ?? 0) * 100,
            )}% missing`,
    },
  };
}
