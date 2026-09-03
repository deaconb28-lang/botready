/**
 * Who gets in: one request, five status lines.
 *
 * Reads the parity check's observed facts and nothing else, so what it shows is
 * exactly what was measured. Rendered on the ink band, as five response status
 * lines — the same material as the grade, because they are the same kind of
 * fact.
 */

import { catalog, type CheckResult, type PerAgentFetch } from '@botready/core';

import { StatusLine } from './primitives';
import type { TranscriptSide } from './Transcript';

/** A short name for each client. The full user agent is in the evidence. */
const SHORT_NAMES: Record<string, string> = {
  chrome: 'Chrome/141',
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
      <div className="wire-line text-ink-key">
        <p className="label text-ink-key">Who gets in</p>
        <p className="mt-3">
          We did not get far enough to compare the clients. Nothing is implied about this site by
          that.
        </p>
      </div>
    );
  }

  const refused = catalog.agents.filter((a) => (perAgent[a.id]?.status ?? 0) >= 400 || perAgent[a.id]?.status === 0);

  return (
    <div>
      <p className="label text-ink-key">Who gets in</p>
      <table className="mt-3 w-full border-collapse">
        <caption className="sr-only">The HTTP status each client received for the same URL</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody className="wire-line">
          {catalog.agents.map((agent, i) => {
            const fact = perAgent[agent.id];
            return (
              <tr key={agent.id} className={i === 0 ? '' : 'border-t border-dashed border-ink-seg'}>
                <th scope="row" className="py-[7px] pr-4 text-left font-normal">
                  {SHORT_NAMES[agent.id] ?? agent.id}
                  {agent.role === 'control' ? <span className="ml-2 text-ink-key">control</span> : null}
                </th>
                <td className="py-[7px] text-right">
                  {fact ? <StatusLine status={fact.transport_error ? 0 : fact.status} onInk /> : <span className="text-ink-key">not asked</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="wire-line mt-4 text-ink-key">
        Same URL, same second, {catalog.agents.length} clients.
        {refused.length > 0 ? ` ${refused.length} refused.` : ' All answered.'}
      </p>
    </div>
  );
}

/**
 * The transcript, filled in with a scan's real numbers. Same component as the
 * landing hero, different data: there it is an example and says so, and here
 * it is the measurement.
 */
export function transcriptFrom(
  results: CheckResult[],
  url: string,
): { host: string; path: string; left: TranscriptSide; right: TranscriptSide } | null {
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');
  const parity = results.find((r) => r.key === 'agent_status_parity');
  if (!ratio) return null;

  const raw = Number(ratio.observed.raw_chars ?? 0);
  const rendered = Number(ratio.observed.rendered_chars ?? 0);
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const control = perAgent[String(parity?.observed.control ?? 'chrome')];
  const worst = Object.entries(perAgent)
    .filter(([id]) => id !== String(parity?.observed.control ?? 'chrome'))
    .sort((a, b) => b[1].status - a[1].status)[0];

  let host = url;
  let path = '/';
  try {
    const u = new URL(url);
    host = u.host;
    path = `${u.pathname}${u.search}` || '/';
  } catch {
    /* keep the raw string */
  }

  const headersOf = (f: PerAgentFetch | undefined): Array<[string, string]> => {
    if (!f) return [];
    const out: Array<[string, string]> = [];
    if (f.content_type) out.push(['content-type', f.content_type]);
    if (f.server) out.push(['server', f.server]);
    if (f.cf_mitigated) out.push(['cf-mitigated', f.cf_mitigated]);
    out.push(['content-length', String(f.bytes)]);
    return out;
  };

  return {
    host,
    path,
    left: {
      client: 'As a browser, after rendering',
      userAgent: 'Mozilla/5.0 … Chrome/141.0',
      status: control?.status ?? 200,
      headers: headersOf(control),
      body: rendered > 0 ? [`${rendered.toLocaleString('en-US')} characters of readable text`] : [],
      chars: rendered,
    },
    right: {
      client: worst ? `As ${SHORT_NAMES[worst[0]] ?? worst[0]}, no JavaScript` : 'As a plain fetch',
      userAgent: worst ? (catalog.agents.find((a) => a.id === worst[0])?.ua ?? worst[0]) : 'BotreadyBot/1.0',
      status: worst ? worst[1].status : raw > 0 ? 200 : 403,
      headers: headersOf(worst?.[1]),
      body: raw > 0 ? [`${raw.toLocaleString('en-US')} characters of readable text`] : [],
      chars: raw,
    },
  };
}
