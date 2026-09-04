/**
 * Everything the account area reads: the person's domains with their latest
 * result, the alerts logged against them, the plan, and this month's usage.
 *
 * A domain is a site this person has claimed. The latest result is computed
 * from evidence the same way the result page does it, so the grade on the
 * domain card can never disagree with the grade on the result page.
 */

import { catalog, scoreDetail, type CheckResult, type PerAgentFetch, type ScoreDetail } from '@botready/core';

import { PLAN_LIMITS } from './site';
import { serviceClient } from './supabase';

export interface DomainCard {
  siteId: string;
  domain: string;
  scanId: string | null;
  status: 'complete' | 'blocked' | 'error' | 'queued' | 'running' | 'none';
  finishedAt: string | null;
  score: ScoreDetail | null;
  previousTotal: number | null;
  /** Each client's status for the latest scan, in catalog order. */
  clients: Array<{ id: string; status: number; ok: boolean }>;
  /** The most recent alert's headline, or a one-line reading of the result. */
  alert: { text: string; bad: boolean };
  results: CheckResult[];
}

export interface AlertLine {
  id: string;
  text: string;
  when: string;
  bad: boolean;
  scanId: string;
}

export type PlanName = 'free' | 'monitor';

export interface PlanView {
  plan: PlanName;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  hasFixpack: boolean;
  limits: { domains: number; scansPerMonth: number };
}

export interface UsageView {
  domains: { used: number; limit: number };
  scans: { used: number; limit: number };
  fixpacks: { used: number };
}

export async function loadDomains(userId: string): Promise<DomainCard[]> {
  const supabase = serviceClient();
  const { data: sites } = await supabase.from('sites').select('id, domain').eq('claimed_by', userId).order('claimed_at', { ascending: true });
  const cards: DomainCard[] = [];
  for (const raw of sites ?? []) {
    const site = raw as { id: string; domain: string };
    cards.push(await domainCard(site.id, site.domain));
  }
  return cards;
}

export async function domainCard(siteId: string, domain: string): Promise<DomainCard> {
  const supabase = serviceClient();
  const { data: scans } = await supabase
    .from('scans')
    .select('id, status, finished_at, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(6);

  const rows = (scans ?? []) as Array<{ id: string; status: DomainCard['status']; finished_at: string | null; created_at: string }>;
  const latest = rows[0];
  const settled = rows.filter((r) => r.status === 'complete' || r.status === 'blocked');
  const current = settled[0] ?? latest;

  let results: CheckResult[] = [];
  let score: ScoreDetail | null = null;
  if (current && current.status === 'complete') {
    results = await evidenceFor(current.id);
    score = results.length > 0 ? scoreDetail(results) : null;
  }

  let previousTotal: number | null = null;
  const previous = settled.find((r, i) => i > 0 && r.status === 'complete');
  if (previous) {
    const prev = await evidenceFor(previous.id);
    if (prev.length > 0) previousTotal = scoreDetail(prev).total;
  }

  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const clients = catalog.agents
    .filter((a) => perAgent[a.id])
    .map((a) => {
      const f = perAgent[a.id] as PerAgentFetch;
      const status = f.transport_error ? 0 : f.status;
      return { id: a.id, status, ok: status >= 200 && status < 300 };
    });

  const latestAlert = await latestAlertFor(siteId);
  const refused = clients.filter((c) => !c.ok && c.id !== 'chrome');
  const alert = latestAlert
    ? { text: latestAlert.text, bad: latestAlert.bad }
    : !current
      ? { text: 'Not scanned yet.', bad: false }
      : current.status === 'blocked'
        ? { text: 'This site refuses our scanner.', bad: true }
        : refused.length > 0
          ? { text: `${refused.length} of ${clients.length - 1} agents ${refused.length === 1 ? 'gets' : 'get'} ${uniqueStatuses(refused)}.`, bad: true }
          : clients.length > 0
            ? { text: 'All five clients reading fine.', bad: false }
            : { text: 'Waiting for the first result.', bad: false };

  return {
    siteId,
    domain,
    scanId: current?.id ?? null,
    status: current?.status ?? (latest?.status ?? 'none'),
    finishedAt: current?.finished_at ?? null,
    score,
    previousTotal,
    clients,
    alert,
    results,
  };
}

function uniqueStatuses(refused: Array<{ status: number }>): string {
  const set = [...new Set(refused.map((r) => (r.status === 0 ? 'no response' : String(r.status))))];
  return set.join(' or ');
}

async function evidenceFor(scanId: string): Promise<CheckResult[]> {
  const { data } = await serviceClient().from('evidence').select('check_key, status, observed, duration_ms').eq('scan_id', scanId);
  return (data ?? []).map((row) => ({
    key: String(row.check_key),
    status: row.status as CheckResult['status'],
    observed: (row.observed ?? {}) as Record<string, unknown>,
    durationMs: Number(row.duration_ms ?? 0),
  }));
}

async function latestAlertFor(siteId: string): Promise<{ text: string; bad: boolean } | null> {
  const supabase = serviceClient();
  const { data: monitors } = await supabase.from('monitors').select('id').eq('site_id', siteId);
  const ids = (monitors ?? []).map((m) => (m as { id: string }).id);
  if (ids.length === 0) return null;
  const { data } = await supabase.from('alerts').select('delta, created_at').in('monitor_id', ids).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return alertText('', (data as { delta: Record<string, unknown> }).delta);
}

/** One line from an alert's stored delta. */
export function alertText(domain: string, delta: Record<string, unknown>): { text: string; bad: boolean } {
  const prefix = domain ? `${domain} — ` : '';
  const refused = Array.isArray(delta.newly_refused) ? (delta.newly_refused as string[]) : [];
  const failed = Array.isArray(delta.newly_failed) ? (delta.newly_failed as string[]) : [];
  const total = typeof delta.total === 'number' ? delta.total : 0;
  const category = typeof delta.category === 'string' ? delta.category : null;
  if (refused.length > 0) return { text: `${prefix}${refused.join(', ')} now refused (was reading)`, bad: true };
  if (category) return { text: `${prefix}${category} dropped${total ? ` · total ${total > 0 ? '+' : ''}${total}` : ''}`, bad: true };
  if (failed.length > 0) return { text: `${prefix}${failed.length} ${failed.length === 1 ? 'check' : 'checks'} started failing: ${failed.join(', ')}`, bad: true };
  if (total < 0) return { text: `${prefix}score fell by ${Math.abs(total)}`, bad: true };
  return { text: `${prefix}score rose by ${total}`, bad: false };
}

export async function loadAlerts(userId: string, limit = 8): Promise<AlertLine[]> {
  const supabase = serviceClient();
  const { data: monitors } = await supabase.from('monitors').select('id, sites(domain)').eq('user_id', userId);
  const byMonitor = new Map<string, string>();
  for (const m of monitors ?? []) {
    const row = m as unknown as { id: string; sites: { domain: string } | null };
    byMonitor.set(row.id, row.sites?.domain ?? '');
  }
  if (byMonitor.size === 0) return [];
  const { data } = await supabase
    .from('alerts')
    .select('id, monitor_id, scan_id, delta, created_at')
    .in('monitor_id', [...byMonitor.keys()])
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((raw) => {
    const row = raw as { id: string; monitor_id: string; scan_id: string; delta: Record<string, unknown>; created_at: string };
    const line = alertText(byMonitor.get(row.monitor_id) ?? '', row.delta);
    return { id: row.id, text: line.text, bad: line.bad, when: row.created_at, scanId: row.scan_id };
  });
}

export async function planFor(userId: string): Promise<PlanView> {
  const { data } = await serviceClient().from('entitlements').select('plan, current_period_end, stripe_customer_id, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  const rows = (data ?? []) as Array<{ plan: string; current_period_end: string | null; stripe_customer_id: string | null }>;
  const live = rows.find((r) => r.plan === 'monitor' && r.current_period_end && new Date(r.current_period_end).getTime() > Date.now());
  const plan: PlanName = live ? 'monitor' : 'free';
  return {
    plan,
    currentPeriodEnd: live?.current_period_end ?? null,
    stripeCustomerId: rows.find((r) => r.stripe_customer_id)?.stripe_customer_id ?? null,
    hasFixpack: rows.some((r) => r.plan === 'fixpack') || Boolean(live),
    limits: PLAN_LIMITS[plan],
  };
}

export async function usageFor(userId: string, plan: PlanView): Promise<UsageView> {
  const supabase = serviceClient();
  const { data: sites } = await supabase.from('sites').select('id').eq('claimed_by', userId);
  const siteIds = (sites ?? []).map((s) => (s as { id: string }).id);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  let scans = 0;
  let fixpacks = 0;
  if (siteIds.length > 0) {
    const { count } = await supabase.from('scans').select('id', { count: 'exact', head: true }).in('site_id', siteIds).gte('created_at', monthStart.toISOString());
    scans = count ?? 0;
    const { count: complete } = await supabase.from('scans').select('id', { count: 'exact', head: true }).in('site_id', siteIds).eq('status', 'complete');
    // Every completed scan regenerates the pack, so this is how many packs exist.
    fixpacks = complete ?? 0;
  }

  return {
    domains: { used: siteIds.length, limit: plan.limits.domains },
    scans: { used: scans, limit: plan.limits.scansPerMonth },
    fixpacks: { used: fixpacks },
  };
}
