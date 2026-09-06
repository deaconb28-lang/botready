import { scoreDetail, type CheckResult } from '@botready/core';

import { persistScore } from './scan-data';
import { serviceClient } from './supabase';

/**
 * Write a score row for every finished scan that has evidence and no score.
 *
 * A score is derived, not measured, so it is written lazily: the first read of
 * a result page computes and stores it. That is fine for a scan somebody asked
 * for and is watching. It is not fine for a scan the nightly cron started,
 * because nobody opens those, and until this runs the scan has evidence and no
 * number — which the chart reads as a site we could not read.
 *
 * Lives here rather than in the nightly route because the nightly route cannot
 * be the only caller. It sweeps before it enqueues, and the scans it enqueues
 * settle minutes after it has returned, so on its own it would always be
 * scoring the previous night's work and never its own.
 */
export async function sweepUnscored(): Promise<number> {
  const supabase = serviceClient();

  // Scans complete in the last two days, so a long-lived backlog is handled a
  // run at a time rather than in one call that times out.
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const { data: scans } = await supabase
    .from('scans')
    .select('id, scores(id)')
    .eq('status', 'complete')
    .gte('finished_at', since)
    .limit(500);

  let written = 0;
  for (const scan of scans ?? []) {
    const row = scan as { id: string; scores: Array<{ id: string }> | null };
    if (row.scores && row.scores.length > 0) continue;

    const { data: evidence } = await supabase
      .from('evidence')
      .select('check_key, status, observed, duration_ms')
      .eq('scan_id', row.id);

    const results: CheckResult[] = (evidence ?? []).map((e) => ({
      key: String(e.check_key),
      status: e.status as CheckResult['status'],
      observed: (e.observed ?? {}) as Record<string, unknown>,
      durationMs: Number(e.duration_ms ?? 0),
    }));

    if (results.length === 0) continue;
    // scoreDetail is what persistScore runs; called here only so a scan with
    // evidence that cannot be scored is skipped rather than half-written.
    scoreDetail(results);
    await persistScore(row.id, results);
    written += 1;
  }
  return written;
}
