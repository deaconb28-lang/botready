import { serviceClient } from './supabase';

/**
 * Everything the dashboard shows, in one round of queries.
 *
 * Reads with the service client, which bypasses row level security. That is the
 * point — this is the one view that has to see every account's rows — and it is
 * also why app/admin/page.tsx checks currentAdmin() before it calls anything in
 * here. Nothing in this file gates itself; the route does it once, at the door.
 *
 * Counts come back as `head: true` count queries rather than as rows, so the
 * dashboard costs a handful of index reads instead of pulling the table across
 * the wire to call .length on it.
 */

export interface Funnel {
  scans: number;
  /** Scans that produced a score. A scan that finished and never got one is a bug. */
  scored: number;
  /** Fix packs sold. */
  packs: number;
  /** Live agency subscriptions. */
  subscriptions: number;
  /** Packs per scan, as a percentage to one decimal. */
  conversion: number;
}

export interface Outcomes {
  grades: Array<{ grade: string; count: number }>;
  averageScore: number;
  blocked: number;
  /** Sites whose latest scan we could read. */
  ranked: number;
}

export interface Health {
  /** Complete, has evidence, has no score. Should be zero; the sweep cron owns it. */
  unscored: number;
  /** Errored scans in the last day. */
  errored: number;
  /** Running for longer than a scan can legitimately take. */
  stuck: number;
  scannerVersions: Array<{ version: string; count: number }>;
}

export interface Activity {
  /** Scan counts per day, oldest first, for the last fourteen days. */
  daily: Array<{ day: string; count: number }>;
  last24h: number;
  last7d: number;
}

export interface AdminMetrics {
  funnel: Funnel;
  outcomes: Outcomes;
  health: Health;
  activity: Activity;
  generatedAt: string;
}

export async function loadAdminMetrics(): Promise<AdminMetrics> {
  const db = serviceClient();
  const count = (table: string) => db.from(table).select('*', { count: 'exact', head: true });
  const since = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

  const [
    scans,
    scored,
    packs,
    subs,
    blocked,
    ranked,
    unscored,
    errored,
    stuck,
    gradeRows,
    scoreRows,
    versionRows,
    dayRows,
    last24,
    last7,
  ] = await Promise.all([
    count('scans'),
    count('scores'),
    count('entitlements').eq('plan', 'fixpack'),
    count('entitlements').eq('plan', 'monitor').gt('current_period_end', new Date().toISOString()),
    count('chart_rows').eq('status', 'blocked'),
    count('chart_rows').not('total', 'is', null),
    // The sweep cron's job, restated as a number: complete scans with no score
    // row. Anything above zero means a scan finished and its score was never
    // written, which is what used to make the chart call read sites unreadable.
    // Embedded rather than a NOT EXISTS because PostgREST has no anti-join, and
    // the same shape lib/sweep.ts uses to find the same rows.
    db.from('scans').select('id, scores(id)').eq('status', 'complete').limit(2000),
    count('scans').eq('status', 'error').gte('created_at', since(24)),
    count('scans').eq('status', 'running').lt('started_at', since(1)),
    db.from('chart_rows').select('grade').not('grade', 'is', null),
    db.from('chart_rows').select('total').not('total', 'is', null),
    db.from('scans').select('scanner_version').not('scanner_version', 'is', null).limit(2000),
    db.from('scans').select('created_at').gte('created_at', since(24 * 14)).limit(5000),
    count('scans').gte('created_at', since(24)),
    count('scans').gte('created_at', since(24 * 7)),
  ]);

  // Counted here rather than in SQL because PostgREST has no group-by and a
  // view per chart would be a migration for something this small.
  const tally = <T extends string>(rows: Array<Record<string, unknown>>, key: string) => {
    const out = new Map<T, number>();
    for (const row of rows) {
      const value = String(row[key] ?? '') as T;
      if (value) out.set(value, (out.get(value) ?? 0) + 1);
    }
    return out;
  };

  const grades = tally<string>((gradeRows.data ?? []) as Array<Record<string, unknown>>, 'grade');
  const versions = tally<string>(
    (versionRows.data ?? []) as Array<Record<string, unknown>>,
    'scanner_version',
  );

  const totals = ((scoreRows.data ?? []) as Array<{ total: number }>).map((r) => Number(r.total));
  const scansCount = scans.count ?? 0;
  const packsCount = packs.count ?? 0;

  return {
    funnel: {
      scans: scansCount,
      scored: scored.count ?? 0,
      packs: packsCount,
      subscriptions: subs.count ?? 0,
      conversion: scansCount > 0 ? Math.round((packsCount / scansCount) * 1000) / 10 : 0,
    },
    outcomes: {
      grades: ['A', 'B', 'C', 'D', 'F'].map((grade) => ({ grade, count: grades.get(grade) ?? 0 })),
      averageScore:
        totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
      blocked: blocked.count ?? 0,
      ranked: ranked.count ?? 0,
    },
    health: {
      unscored: ((unscored.data ?? []) as Array<{ scores: unknown[] | null }>).filter(
        (row) => !row.scores || row.scores.length === 0,
      ).length,
      errored: errored.count ?? 0,
      stuck: stuck.count ?? 0,
      scannerVersions: [...versions.entries()]
        .map(([version, n]) => ({ version, count: n }))
        .sort((a, b) => b.count - a.count),
    },
    activity: {
      daily: byDay((dayRows.data ?? []) as Array<{ created_at: string }>),
      last24h: last24.count ?? 0,
      last7d: last7.count ?? 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Fourteen buckets, oldest first, including the days with nothing in them. */
function byDay(rows: Array<{ created_at: string }>): Array<{ day: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const out: Array<{ day: string; count: number }> = [];
  for (let back = 13; back >= 0; back -= 1) {
    const day = new Date(Date.now() - back * 24 * 3600_000).toISOString().slice(0, 10);
    // A day with no scans is a fact about the day, and dropping it would make a
    // quiet week look like a busy one with fewer bars.
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}
