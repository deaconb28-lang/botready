import { markScanErrored } from './scan-data';
import { REAP_AFTER_MS, STOPPED_MESSAGE } from './scan-gate';
import { serviceClient } from './supabase';

export interface Reaped {
  id: string;
  domain: string;
  minutes: number;
}

/**
 * Settle every scan that stopped rather than finished.
 *
 * The worker is the only thing that marks a scan finished, so a worker that
 * restarts mid-scan leaves the row at `running` with nothing that will ever
 * change it. `/api/scan/[id]` already settles the one scan it is asked about,
 * which covers a person watching the live page. It covers nothing else: a scan
 * the nightly index cron started has no audience, so it sits at `running`
 * forever, counts against the concurrency nobody is using, and shows up on the
 * dashboard as a number that only ever goes up.
 *
 * Seven of them accumulated before this existed — two duplicate submissions
 * for github.com and five from one index run, all with partial evidence and
 * all still "running" two days later.
 *
 * Reaped rather than scored, even where most of the checks did run. A partial
 * scan can be scored — nothing stops the arithmetic — and the number that
 * comes out is wrong in a way nobody can see, because the checks that never
 * ran are missing from the denominator rather than failing in it. A site whose
 * scan died after the four cheap checks would score suspiciously well. An
 * error says what happened; a plausible number does not.
 */
export async function reapStuckScans(now: number = Date.now()): Promise<Reaped[]> {
  const supabase = serviceClient();

  // Two shapes of dead. A running scan is one the worker picked up and never
  // finished; a queued one is a job QStash dropped or a worker that was down
  // when it arrived. Measured from started_at where there is one, because a
  // scan that waited in the queue for ten minutes and then ran for one has
  // been running for one.
  const { data, error } = await supabase
    .from('scans')
    .select('id, status, started_at, created_at, sites(domain)')
    .in('status', ['running', 'queued'])
    .limit(500);

  if (error || !data) return [];

  const dead = (data as Array<Record<string, unknown>>).filter((row) => {
    const began = Date.parse(String(row.started_at ?? row.created_at));
    return Number.isFinite(began) && now - began > REAP_AFTER_MS;
  });

  const reaped: Reaped[] = [];
  for (const row of dead) {
    const id = String(row.id);
    const domain = String((row.sites as { domain?: string } | null)?.domain ?? '');
    const began = Date.parse(String(row.started_at ?? row.created_at));

    await markScanErrored(id, STOPPED_MESSAGE);

    // And forget the cached scan for that domain, or the 24-hour window hands
    // the next person this same dead scan instead of crawling. Best effort:
    // the cache expiring on its own is a slower version of the same outcome,
    // and a Redis blip must not stop the row being settled.
    if (domain) {
      try {
        const [{ forgetCachedScan }, { defaultKV }] = await Promise.all([
          import('./redis'),
          import('./kv'),
        ]);
        await forgetCachedScan(domain, defaultKV());
      } catch {
        // Nothing to do about it, and nothing that depends on it.
      }
    }

    reaped.push({ id, domain, minutes: Math.round((now - began) / 60_000) });
  }

  if (reaped.length > 0) {
    // One line naming what was settled, because a scan disappearing from
    // "running" without a trace is the kind of thing that is impossible to
    // reconstruct later.
    console.info(
      `[reap] settled ${reaped.length} stopped scan(s): ${reaped
        .map((r) => `${r.domain || r.id} after ${r.minutes}m`)
        .join(', ')}`,
    );
  }
  return reaped;
}
