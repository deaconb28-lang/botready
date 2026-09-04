import { catalog, type CheckResult, type PerAgentFetch } from '@botready/core';

import { SoftChip } from '@/components/ui';
import { CLIENT_IDS, formatInt } from '@/lib/theme';

/**
 * What each of the five clients got for the same URL. Reads the parity check
 * and the JS ratio check and nothing else, so what it shows is exactly what
 * was measured.
 */
export function ClientPanel({ results, sticky = true }: { results: CheckResult[]; sticky?: boolean }) {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');
  const rawChars = Number(ratio?.observed.raw_chars ?? 0);
  const renderedChars = Number(ratio?.observed.rendered_chars ?? 0);
  const controlId = String(parity?.observed.control ?? 'chrome');

  return (
    <aside className={`edge overflow-hidden rounded-[16px] bg-white shadow-hard-4 ${sticky ? 'lg:sticky lg:top-[88px]' : ''}`} aria-label="What each client got">
      <div className="border-b border-hairline px-5 py-4 font-mono text-[11.5px] font-medium tracking-[0.1em] text-subtle-2 uppercase">What each client got</div>
      {Object.keys(perAgent).length === 0 ? (
        <p className="px-5 py-4 text-[13.5px] leading-[1.5] text-subtle-2">We did not get far enough to compare the clients. Nothing is implied about this site by that.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {catalog.agents.map((agent) => {
            const fact = perAgent[agent.id];
            if (!fact) return null;
            const ok = fact.status >= 200 && fact.status < 300 && !fact.transport_error;
            // The control's readable characters come from the render; an agent's from
            // the raw response. A refused client shows the bytes it was sent instead.
            const chars = agent.id === controlId ? renderedChars : rawChars;
            return (
              <li key={agent.id} className="flex items-center gap-3 border-b border-hairline-2 px-5 py-[14px]">
                <span className="min-w-0 flex-1 font-mono text-[13px] font-medium">{CLIENT_IDS[agent.id] ?? agent.id}</span>
                <span className="font-mono text-[12px] text-placeholder">{ok ? `${formatInt(chars)} chars` : fact.transport_error ? 'no response' : `${formatInt(fact.bytes)} B`}</span>
                <SoftChip tone={ok ? 'ok' : 'bad'}>{fact.transport_error ? 'ERR' : fact.status}</SoftChip>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-5 py-4 text-[13.5px] leading-[1.5] text-subtle-2">Same URL, same second. The Chrome request is the control.</p>
    </aside>
  );
}
