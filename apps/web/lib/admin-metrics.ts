import { serviceClient } from './supabase';
import { stripe } from './stripe';

/**
 * Everything the dashboard shows, in one round of queries.
 *
 * Reads with the service client, which bypasses row level security. That is the
 * point — this is the one view that has to see every account's rows — and it is
 * also why app/admin/page.tsx checks currentAdmin() before it calls anything in
 * here. Nothing in this file gates itself; the route does it once, at the door.
 *
 * Two rules this file follows.
 *
 * Aggregates come from the views in migration 0011 rather than from rows
 * tallied here. PostgREST has no group-by, so the first version pulled every
 * evidence row and counted them in JavaScript; evidence grows twenty-one rows
 * per scan and that stops being reasonable somewhere around a thousand scans.
 * Counts of whole tables stay as `head: true` count queries, which are an index
 * read either way.
 *
 * Money comes from Stripe, not from multiplying our own prices by our own row
 * counts. A promotion code, a refund or a proration makes the second one a
 * plausible-looking lie, and this dashboard is the thing that is supposed to
 * tell us the truth. If Stripe is unreachable the revenue panel says so rather
 * than showing a zero that reads like no sales.
 */

export interface Funnel {
  scans: number;
  /** Scans that produced a score. A scan that finished and never got one is a bug. */
  scored: number;
  /** Fix packs sold. */
  packs: number;
  /** Live subscriptions, either tier. */
  subscriptions: number;
  /** Packs per scan, as a percentage to one decimal. */
  conversion: number;
  /** People who have ever signed in. */
  accounts: number;
  /** Domains somebody has proven they control. */
  claimed: number;
}

export interface Revenue {
  /** Null when Stripe could not be reached. Not zero: zero means no sales. */
  available: boolean;
  /** Successful charges, minus what was refunded, in whole dollars. */
  grossAllTime: number;
  gross30d: number;
  gross7d: number;
  refunded: number;
  payments: number;
  /** Mean successful payment, in dollars. */
  averageOrder: number;
  /** Monthly recurring revenue from live subscriptions. */
  mrr: number;
  /** Most recent payments, newest first. */
  recent: Array<{ date: string; amount: number; description: string; refunded: boolean }>;
}

export interface Outcomes {
  grades: Array<{ grade: string; count: number }>;
  averageScore: number;
  blocked: number;
  /** Sites whose latest scan we could read. */
  ranked: number;
  /** Every site we have a row for, scored or not. */
  seen: number;
  categories: Array<{ category: string; average: number }>;
}

export interface CheckStat {
  key: string;
  fails: number;
  warns: number;
  passes: number;
  skips: number;
  /** Percent of the sites measured on this check that failed it. */
  failRate: number;
  avgMs: number;
}

export interface Health {
  /** Complete, has evidence, has no score. Should be zero; the sweep cron owns it. */
  unscored: number;
  /** Errored scans in the last day, and ever. */
  errored: number;
  erroredAllTime: number;
  /** Running for longer than a scan can legitimately take. */
  stuck: number;
  queued: number;
  scannerVersions: Array<{ version: string; count: number }>;
  scoringVersions: Array<{ version: string; count: number }>;
}

export interface Timing {
  measured: number;
  p50: number;
  p95: number;
  slowest: number;
  avgPages: number;
  /** The checks that cost the most wall time, worst first. */
  slowestChecks: Array<{ key: string; avgMs: number }>;
}

export interface Activity {
  /** Scan counts per day, oldest first, for the last thirty days. */
  daily: Array<{ day: string; total: number; complete: number; blocked: number; errored: number }>;
  last24h: number;
  last7d: number;
  last30d: number;
  triggers: Array<{ trigger: string; total: number; complete: number; failed: number }>;
}

export interface Reach {
  topDomains: Array<{ domain: string; scans: number; lastScan: string }>;
  /** Sites scanned more than once. Somebody came back, or the cron did. */
  rescanned: number;
  monitors: number;
  prompts: number;
  promptRuns: number;
  competitors: number;
  alerts: number;
}

export interface AdminMetrics {
  funnel: Funnel;
  revenue: Revenue;
  outcomes: Outcomes;
  checks: CheckStat[];
  health: Health;
  timing: Timing;
  activity: Activity;
  reach: Reach;
  recentScans: Array<{ domain: string; status: string; total: number | null; grade: string | null; at: string }>;
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
    seen,
    claimed,
    unscored,
    errored,
    erroredAll,
    stuck,
    queued,
    gradeRows,
    scoreRows,
    versionRows,
    checkRows,
    categoryRows,
    triggerRows,
    dayRows,
    timingRows,
    domainRows,
    scoringRows,
    monitors,
    prompts,
    promptRuns,
    competitors,
    alerts,
    recent,
    last24,
    last7,
    last30,
    accounts,
    revenue,
  ] = await Promise.all([
    count('scans'),
    count('scores'),
    count('entitlements').eq('plan', 'fixpack'),
    count('entitlements').in('plan', ['monitor', 'agency']).gt('current_period_end', new Date().toISOString()),
    count('chart_rows').eq('status', 'blocked'),
    count('chart_rows').not('total', 'is', null),
    count('sites'),
    count('sites').eq('is_claimed', true),
    // The sweep cron's job, restated as a number: complete scans with no score
    // row. Anything above zero means a scan finished and its score was never
    // written, which is what used to make the chart call read sites unreadable.
    // Embedded rather than a NOT EXISTS because PostgREST has no anti-join, and
    // the same shape lib/sweep.ts uses to find the same rows.
    db.from('scans').select('id, scores(id)').eq('status', 'complete').limit(2000),
    count('scans').eq('status', 'error').gte('created_at', since(24)),
    count('scans').eq('status', 'error'),
    count('scans').eq('status', 'running').lt('started_at', since(1)),
    count('scans').eq('status', 'queued'),
    db.from('chart_rows').select('grade').not('grade', 'is', null),
    db.from('chart_rows').select('total').not('total', 'is', null),
    db.from('scans').select('scanner_version').not('scanner_version', 'is', null).limit(5000),
    db.from('admin_check_stats').select('*'),
    db.from('admin_category_scores').select('*'),
    db.from('admin_trigger_mix').select('*'),
    db.from('admin_daily_scans').select('*'),
    db.from('admin_scan_timing').select('*').maybeSingle(),
    db.from('admin_top_domains').select('*'),
    db.from('admin_scoring_versions').select('*'),
    count('monitors').eq('is_active', true),
    count('prompts').eq('is_active', true),
    count('prompt_runs'),
    count('competitors'),
    count('alerts'),
    db
      .from('chart_rows')
      .select('domain, status, total, grade, finished_at')
      .order('finished_at', { ascending: false })
      .limit(12),
    count('scans').gte('created_at', since(24)),
    count('scans').gte('created_at', since(24 * 7)),
    count('scans').gte('created_at', since(24 * 30)),
    countAccounts(),
    loadRevenue(),
  ]);

  // Still tallied here: the two columns with no view, both small and both
  // already fetched as rows for other reasons.
  const tally = (rows: Array<Record<string, unknown>>, key: string) => {
    const out = new Map<string, number>();
    for (const row of rows) {
      const value = String(row[key] ?? '');
      if (value) out.set(value, (out.get(value) ?? 0) + 1);
    }
    return out;
  };

  const grades = tally((gradeRows.data ?? []) as Array<Record<string, unknown>>, 'grade');
  const versions = tally((versionRows.data ?? []) as Array<Record<string, unknown>>, 'scanner_version');

  const totals = ((scoreRows.data ?? []) as Array<{ total: number }>).map((r) => Number(r.total));
  const scansCount = scans.count ?? 0;
  const packsCount = packs.count ?? 0;

  const checks = ((checkRows.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      key: String(row.check_key),
      fails: Number(row.fails ?? 0),
      warns: Number(row.warns ?? 0),
      passes: Number(row.passes ?? 0),
      skips: Number(row.skips ?? 0),
      failRate: Number(row.fail_rate ?? 0),
      avgMs: Number(row.avg_ms ?? 0),
    }))
    .sort((a, b) => b.failRate - a.failRate);

  const timing = (timingRows.data ?? {}) as Record<string, unknown>;

  return {
    funnel: {
      scans: scansCount,
      scored: scored.count ?? 0,
      packs: packsCount,
      subscriptions: subs.count ?? 0,
      conversion: scansCount > 0 ? Math.round((packsCount / scansCount) * 1000) / 10 : 0,
      accounts,
      claimed: claimed.count ?? 0,
    },
    revenue,
    outcomes: {
      grades: ['A', 'B', 'C', 'D', 'F'].map((grade) => ({ grade, count: grades.get(grade) ?? 0 })),
      averageScore:
        totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
      blocked: blocked.count ?? 0,
      ranked: ranked.count ?? 0,
      seen: seen.count ?? 0,
      categories: ((categoryRows.data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({ category: String(row.category), average: Number(row.average ?? 0) }))
        .sort((a, b) => a.average - b.average),
    },
    checks,
    health: {
      unscored: ((unscored.data ?? []) as Array<{ scores: unknown[] | null }>).filter(
        (row) => !row.scores || row.scores.length === 0,
      ).length,
      errored: errored.count ?? 0,
      erroredAllTime: erroredAll.count ?? 0,
      stuck: stuck.count ?? 0,
      queued: queued.count ?? 0,
      scannerVersions: [...versions.entries()]
        .map(([version, n]) => ({ version, count: n }))
        .sort((a, b) => b.count - a.count),
      scoringVersions: ((scoringRows.data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({ version: String(row.scoring_version), count: Number(row.count ?? 0) }))
        .sort((a, b) => b.count - a.count),
    },
    timing: {
      measured: Number(timing.measured ?? 0),
      p50: Number(timing.p50 ?? 0),
      p95: Number(timing.p95 ?? 0),
      slowest: Number(timing.slowest ?? 0),
      avgPages: Number(timing.avg_pages ?? 0),
      slowestChecks: [...checks]
        .filter((c) => c.avgMs > 0)
        .sort((a, b) => b.avgMs - a.avgMs)
        .slice(0, 6)
        .map((c) => ({ key: c.key, avgMs: c.avgMs })),
    },
    activity: {
      daily: byDay((dayRows.data ?? []) as Array<Record<string, unknown>>),
      last24h: last24.count ?? 0,
      last7d: last7.count ?? 0,
      last30d: last30.count ?? 0,
      triggers: byTrigger((triggerRows.data ?? []) as Array<Record<string, unknown>>),
    },
    reach: {
      topDomains: ((domainRows.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        domain: String(row.domain),
        scans: Number(row.scans ?? 0),
        lastScan: String(row.last_scan ?? ''),
      })),
      rescanned: ((domainRows.data ?? []) as Array<Record<string, unknown>>).filter(
        (row) => Number(row.scans ?? 0) > 1,
      ).length,
      monitors: monitors.count ?? 0,
      prompts: prompts.count ?? 0,
      promptRuns: promptRuns.count ?? 0,
      competitors: competitors.count ?? 0,
      alerts: alerts.count ?? 0,
    },
    recentScans: ((recent.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      domain: String(row.domain),
      status: String(row.status),
      total: row.total === null || row.total === undefined ? null : Number(row.total),
      grade: row.grade ? String(row.grade) : null,
      at: String(row.finished_at ?? ''),
    })),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * How many people have an account.
 *
 * auth.users is not exposed through PostgREST, so this goes through the admin
 * API. `perPage: 1` because the total is all we want and the addresses are not
 * ours to pull across the wire for a counter.
 */
async function countAccounts(): Promise<number> {
  try {
    const { data, error } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return 0;
    return (data as { total?: number }).total ?? data.users.length;
  } catch {
    return 0;
  }
}

/**
 * Real money, from Stripe.
 *
 * Charges rather than our own arithmetic, for the reason in the file header: a
 * promotion code makes $15 into $7.50 and nothing in our tables knows that.
 * LAUNCHWEEK is live as this ships, so the derived number would already be
 * wrong by half.
 *
 * `available: false` on any failure, so the panel can say "Stripe did not
 * answer" instead of drawing a convincing zero.
 */
async function loadRevenue(): Promise<Revenue> {
  const empty: Revenue = {
    available: false,
    grossAllTime: 0,
    gross30d: 0,
    gross7d: 0,
    refunded: 0,
    payments: 0,
    averageOrder: 0,
    mrr: 0,
    recent: [],
  };

  try {
    const client = stripe();
    const [charges, subscriptions] = await Promise.all([
      client.charges.list({ limit: 100 }),
      client.subscriptions.list({ status: 'active', limit: 100 }),
    ]);

    const paid = charges.data.filter((c) => c.paid && c.status === 'succeeded');
    const cutoff = (days: number) => Date.now() / 1000 - days * 86_400;
    const net = (c: (typeof paid)[number]) => c.amount - c.amount_refunded;

    const grossAllTime = paid.reduce((sum, c) => sum + net(c), 0);
    const refunded = paid.reduce((sum, c) => sum + c.amount_refunded, 0);

    // Stripe quotes a subscription price in the interval it bills on, so a
    // yearly plan has to be divided back down before it can sit beside a
    // monthly one under the letters MRR.
    const mrr = subscriptions.data.reduce((sum, sub) => {
      for (const item of sub.items.data) {
        const amount = item.price.unit_amount ?? 0;
        const quantity = item.quantity ?? 1;
        const interval = item.price.recurring?.interval;
        const every = item.price.recurring?.interval_count ?? 1;
        const perMonth =
          interval === 'year' ? amount / (12 * every)
          : interval === 'week' ? (amount * 52) / (12 * every)
          : interval === 'day' ? (amount * 365) / (12 * every)
          : amount / every;
        sum += perMonth * quantity;
      }
      return sum;
    }, 0);

    return {
      available: true,
      grossAllTime: Math.round(grossAllTime / 100),
      gross30d: Math.round(paid.filter((c) => c.created >= cutoff(30)).reduce((s, c) => s + net(c), 0) / 100),
      gross7d: Math.round(paid.filter((c) => c.created >= cutoff(7)).reduce((s, c) => s + net(c), 0) / 100),
      refunded: Math.round(refunded / 100),
      payments: paid.length,
      averageOrder: paid.length > 0 ? Math.round(grossAllTime / paid.length) / 100 : 0,
      mrr: Math.round(mrr / 100),
      recent: paid.slice(0, 8).map((c) => ({
        date: new Date(c.created * 1000).toISOString(),
        amount: Math.round(net(c)) / 100,
        description: c.description ?? 'Payment',
        refunded: c.amount_refunded > 0,
      })),
    };
  } catch (err) {
    console.error('[admin] Stripe did not answer; the revenue panel will say so', err);
    return empty;
  }
}

/** Thirty buckets, oldest first, including the days with nothing in them. */
export function byDay(
  rows: Array<Record<string, unknown>>,
): Array<{ day: string; total: number; complete: number; blocked: number; errored: number }> {
  const byDate = new Map<string, Record<string, unknown>>();
  for (const row of rows) byDate.set(String(row.day).slice(0, 10), row);

  const out = [];
  for (let back = 29; back >= 0; back -= 1) {
    const day = new Date(Date.now() - back * 24 * 3600_000).toISOString().slice(0, 10);
    const row = byDate.get(day);
    // A day with no scans is a fact about the day, and dropping it would make a
    // quiet week look like a busy one with fewer bars.
    out.push({
      day,
      total: Number(row?.total ?? 0),
      complete: Number(row?.complete ?? 0),
      blocked: Number(row?.blocked ?? 0),
      errored: Number(row?.errored ?? 0),
    });
  }
  return out;
}

/** One row per trigger, with the outcomes folded into it. */
export function byTrigger(
  rows: Array<Record<string, unknown>>,
): Array<{ trigger: string; total: number; complete: number; failed: number }> {
  const out = new Map<string, { trigger: string; total: number; complete: number; failed: number }>();
  for (const row of rows) {
    const trigger = String(row.trigger);
    const status = String(row.status);
    const n = Number(row.count ?? 0);
    const entry = out.get(trigger) ?? { trigger, total: 0, complete: 0, failed: 0 };
    entry.total += n;
    if (status === 'complete') entry.complete += n;
    if (status === 'error' || status === 'blocked') entry.failed += n;
    out.set(trigger, entry);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}
