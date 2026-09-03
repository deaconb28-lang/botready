/**
 * The worker's database access. postgres.js, one long-lived connection pool, on
 * the session pooler port. The transaction pooler will pull prepared statements
 * out from under a long-lived client, which shows up as intermittent
 * "prepared statement does not exist" a week after deploy rather than at boot.
 *
 * Two invariants live here rather than in the caller:
 *   evidence never carries a score, so this module has no access to scoring
 *   every scan row gets a scanner_version, set when the worker picks the job up
 */

import postgres, { type JSONValue } from 'postgres';

import type { CheckResult, ScanStatus } from '@botready/core';

import { env } from './env';
import { SCANNER_VERSION } from './version';

export const sql = postgres(env.databaseUrl, {
  max: Math.max(2, env.concurrency + 1),
  idle_timeout: 0, // long-lived on purpose; see the note above
  connect_timeout: 15,
  prepare: true,
  onnotice: () => {},
});

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}

/** Marks the scan running and stamps the version of the worker that took it. */
export async function markRunning(scanId: string): Promise<void> {
  await sql`
    update scans
       set status          = 'running',
           scanner_version = ${SCANNER_VERSION},
           started_at       = coalesce(started_at, now())
     where id = ${scanId}
  `;
}

export async function markFinished(
  scanId: string,
  status: Extract<ScanStatus, 'complete' | 'blocked' | 'error'>,
  opts: { pagesCrawled: number; errorMessage?: string },
): Promise<void> {
  await sql`
    update scans
       set status        = ${status},
           pages_crawled = ${opts.pagesCrawled},
           error_message = ${opts.errorMessage ?? null},
           finished_at   = now()
     where id = ${scanId}
  `;
}

/**
 * Evidence is append-only per scan, but a retried delivery can legitimately
 * re-observe the same check, so the unique (scan_id, check_key) constraint is
 * resolved by keeping the newer observation. That is still append-only in
 * spirit: we never merge two observations into one row.
 */
export async function writeEvidence(scanId: string, results: CheckResult[]): Promise<void> {
  if (results.length === 0) return;

  const rows = results.map((r) => ({
    scan_id: scanId,
    check_key: r.key,
    status: r.status,
    observed: sql.json(r.observed as JSONValue),
    duration_ms: Math.round(r.durationMs),
  }));

  await sql`
    insert into evidence ${sql(rows, 'scan_id', 'check_key', 'status', 'observed', 'duration_ms')}
    on conflict (scan_id, check_key) do update
      set status      = excluded.status,
          observed    = excluded.observed,
          duration_ms = excluded.duration_ms,
          created_at  = now()
  `;
}

export interface ScanTarget {
  scanId: string;
  url: string;
  siteId: string;
  domain: string;
}

/** Reads back what the web app queued, so the worker trusts the row not the body. */
export async function loadScan(scanId: string): Promise<ScanTarget | null> {
  const rows = await sql<Array<{ id: string; url: string; site_id: string; domain: string }>>`
    select s.id, s.url, s.site_id, si.domain
      from scans s
      join sites si on si.id = s.site_id
     where s.id = ${scanId}
  `;
  const row = rows[0];
  if (!row) return null;
  return { scanId: row.id, url: row.url, siteId: row.site_id, domain: row.domain };
}
