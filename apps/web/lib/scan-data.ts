/**
 * Reading a scan back out.
 *
 * The score is computed here, on read, from the evidence rows, rather than
 * being trusted from the `scores` table. The stored row is a cache and a
 * historical record; the number on the page comes from running the pure
 * function over the facts. That way a weight change shows up on every page at
 * once and a stale score row can never disagree with the evidence under it.
 */

import {
  classifySegment,
  findings,
  passing,
  scoreDetail,
  type CheckResult,
  type Finding,
  type ScoreDetail,
  type ScanRow,
  type SiteRow,
} from '@botready/core';

import { publicClient, serviceClient } from './supabase';

export interface ScanView {
  scan: ScanRow;
  site: SiteRow;
  results: CheckResult[];
  /** Null while the scan is queued or running, and for a blocked scan. */
  score: ScoreDetail | null;
  findings: Finding[];
  passing: Finding[];
}

export async function loadScanView(scanId: string): Promise<ScanView | null> {
  const supabase = publicClient();

  const { data: scan, error } = await supabase
    .from('scans')
    .select('*, sites(*)')
    .eq('id', scanId)
    .maybeSingle();

  if (error || !scan) return null;

  const site = (scan as { sites: SiteRow }).sites;
  const { data: evidence } = await supabase
    .from('evidence')
    .select('check_key, status, observed, duration_ms')
    .eq('scan_id', scanId);

  const results: CheckResult[] = (evidence ?? []).map((row) => ({
    key: row.check_key as string,
    status: row.status as CheckResult['status'],
    observed: (row.observed ?? {}) as Record<string, unknown>,
    durationMs: (row.duration_ms as number | null) ?? 0,
  }));

  const scanRow = scan as unknown as ScanRow;
  const scorable = scanRow.status === 'complete' && results.length > 0;

  return {
    scan: scanRow,
    site,
    results,
    score: scorable ? scoreDetail(results) : null,
    findings: scorable ? findings(results) : [],
    passing: scorable ? passing(results) : [],
  };
}

/**
 * Writes the score row. Derived and deliberately so: recomputing every row from
 * `evidence` after a weight change is a single pass over this function, which is
 * the whole point of keeping the two tables apart.
 *
 * Called after a scan completes and by the re-score path. Idempotent on
 * (scan_id, scoring_version).
 */
export async function persistScore(scanId: string, results: CheckResult[]): Promise<void> {
  if (results.length === 0) return;
  const computed = scoreDetail(results);

  await serviceClient()
    .from('scores')
    .upsert(
      {
        scan_id: scanId,
        scoring_version: computed.scoringVersion,
        total: computed.total,
        grade: computed.grade,
        category_scores: computed.categoryScores,
        // The stored list is the failures plus the errors, because that is what
        // "checks that did not earn their points" means to a reader of the
        // table. The interface keeps them apart; the archive does not need to.
        failed_checks: [...computed.failedChecks, ...computed.erroredChecks],
      },
      { onConflict: 'scan_id,scoring_version' },
    );

  // A settled scan is also the only moment we know enough to file the site in
  // the public index. Best effort: a score that is written and a segment that
  // is not is a smaller problem than a score that is not written at all.
  await inferSegment(scanId, results).catch(() => {});
}

/**
 * File the site in a segment, if the scan's evidence is unambiguous enough to
 * say. This is what lets a site anyone scanned appear in the ranking and get
 * re-scanned by the nightly cron; without it `sites.segment` was only ever
 * written by the seed script and the index listed the seed cohort forever.
 *
 * Only ever fills a blank. A segment set by the seed or stated by the owner is
 * an answer from someone who knows, and an inference does not get to overrule
 * it — including on every subsequent re-scan.
 */
async function inferSegment(scanId: string, results: CheckResult[]): Promise<void> {
  const verdict = classifySegment(results);
  if (!verdict) return;

  const supabase = serviceClient();
  const { data: scan } = await supabase.from('scans').select('site_id').eq('id', scanId).maybeSingle();
  const siteId = (scan as { site_id?: string } | null)?.site_id;
  if (!siteId) return;

  const { data: site } = await supabase.from('sites').select('segment').eq('id', siteId).maybeSingle();
  if ((site as { segment?: string | null } | null)?.segment) return;

  await supabase
    .from('sites')
    .update({ segment: verdict.segment, segment_source: 'inferred' })
    .eq('id', siteId)
    .is('segment', null);
}

/** The most recent finished scan for a domain, for the index and the cache. */
export async function latestScanForDomain(domain: string): Promise<ScanRow | null> {
  const supabase = publicClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();
  if (!site) return null;

  const { data: scan } = await supabase
    .from('scans')
    .select('*')
    .eq('site_id', (site as { id: string }).id)
    .in('status', ['complete', 'blocked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (scan as ScanRow | null) ?? null;
}

/** Creates the site row if it is new, and returns its id either way. */
export async function upsertSite(domain: string, segment?: string): Promise<string> {
  const supabase = serviceClient();

  const { data: existing } = await supabase
    .from('sites')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data, error } = await supabase
    .from('sites')
    .insert({ domain, ...(segment ? { segment } : {}) })
    .select('id')
    .single();

  if (error || !data) {
    // A concurrent insert lost the race on the unique index. Read it back.
    const { data: raced } = await supabase
      .from('sites')
      .select('id')
      .eq('domain', domain)
      .maybeSingle();
    if (raced) return (raced as { id: string }).id;
    throw new Error(`Could not record the site ${domain}: ${error?.message ?? 'unknown'}`);
  }

  return (data as { id: string }).id;
}

export async function createScan(opts: {
  siteId: string;
  url: string;
  trigger: ScanRow['trigger'];
}): Promise<string> {
  const { data, error } = await serviceClient()
    .from('scans')
    .insert({ site_id: opts.siteId, url: opts.url, trigger: opts.trigger, status: 'queued' })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Could not queue the scan: ${error?.message ?? 'unknown'}`);
  return (data as { id: string }).id;
}

export async function markScanErrored(scanId: string, message: string): Promise<void> {
  await serviceClient()
    .from('scans')
    .update({ status: 'error', error_message: message, finished_at: new Date().toISOString() })
    .eq('id', scanId);
}
