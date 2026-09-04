/**
 * Everything the app reads about one property: its latest result, the
 * findings, the generated files, the projected grade after the fixes, the
 * competitors ranked beside it, and the prompts being watched.
 */

import {
  buildFixPack,
  catalog,
  findings,
  score as scoreOf,
  scoreDetail,
  type CheckResult,
  type Finding,
  type FixPack,
  type PerAgentFetch,
  type ScoreDetail,
} from '@botready/core';

import { serviceClient } from './supabase';

export interface Property {
  siteId: string;
  domain: string;
  scanId: string | null;
  status: 'complete' | 'blocked' | 'error' | 'queued' | 'running' | 'none';
  finishedAt: string | null;
  /** How many finished scans this domain has had; the sidebar prints "run 04". */
  runNumber: number;
  results: CheckResult[];
  score: ScoreDetail | null;
  previous: { total: number; grade: string } | null;
  findings: Finding[];
  pack: FixPack | null;
  /** The score if every check with a generated remedy passed. */
  projected: { total: number; grade: string } | null;
  clients: Array<{ id: string; status: number; ok: boolean; note: string }>;
}

export async function listProperties(userId: string): Promise<Array<{ siteId: string; domain: string }>> {
  const { data } = await serviceClient().from('sites').select('id, domain').eq('claimed_by', userId).order('claimed_at', { ascending: true });
  return (data ?? []).map((s) => ({ siteId: (s as { id: string }).id, domain: (s as { domain: string }).domain }));
}

export async function loadProperty(domain: string, userId: string): Promise<Property | null> {
  const supabase = serviceClient();
  const { data: site } = await supabase.from('sites').select('id, domain, claimed_by').eq('domain', domain).maybeSingle();
  const row = site as { id: string; domain: string; claimed_by: string | null } | null;
  if (!row || row.claimed_by !== userId) return null;

  const { data: scans } = await supabase
    .from('scans')
    .select('id, status, finished_at, created_at')
    .eq('site_id', row.id)
    .order('created_at', { ascending: false })
    .limit(20);
  const list = (scans ?? []) as Array<{ id: string; status: Property['status']; finished_at: string | null; created_at: string }>;
  const finished = list.filter((s) => s.status === 'complete' || s.status === 'blocked');
  const current = finished[0] ?? list[0];

  let results: CheckResult[] = [];
  if (current?.status === 'complete') results = await evidenceFor(current.id);
  const score = results.length > 0 ? scoreDetail(results) : null;
  const list2 = score ? findings(results) : [];
  const pack = score ? buildFixPack(row.domain, results) : null;

  const previousScan = finished.find((s, i) => i > 0 && s.status === 'complete');
  let previous: Property['previous'] = null;
  if (previousScan) {
    const prev = await evidenceFor(previousScan.id);
    if (prev.length > 0) {
      const p = scoreOf(prev);
      previous = { total: p.total, grade: p.grade };
    }
  }

  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const ratio = results.find((r) => r.key === 'js_dependency_ratio');
  const jsRatio = Number(ratio?.observed.ratio ?? 0);
  const clients = catalog.agents
    .filter((a) => perAgent[a.id])
    .map((a) => {
      const f = perAgent[a.id] as PerAgentFetch;
      const status = f.transport_error ? 0 : f.status;
      const ok = status >= 200 && status < 300;
      return { id: a.id, status, ok, note: clientNote(f, ok, jsRatio) };
    });

  return {
    siteId: row.id,
    domain: row.domain,
    scanId: current?.id ?? null,
    status: current?.status ?? 'none',
    finishedAt: current?.finished_at ?? null,
    runNumber: finished.length,
    results,
    score,
    previous,
    findings: list2,
    pack,
    projected: score ? projectedScore(results) : null,
    clients,
  };
}

/** What the request panel prints beside each status. Facts from the fetch. */
function clientNote(f: PerAgentFetch, ok: boolean, jsRatio: number): string {
  if (f.transport_error) return f.transport_error;
  if (!ok) return f.cf_mitigated ? `cf-mitigated: ${f.cf_mitigated}` : f.server ? `server: ${f.server}` : `HTTP ${f.status}`;
  if (jsRatio > 0.7) return 'body is client-side';
  return `${formatBytes(f.bytes)} · ${f.total_ms} ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * "A after these": the score if every check that has a generated remedy
 * passed. Pure arithmetic over the same scorer, so it is a projection of the
 * catalog's weights and not a promise.
 */
export function projectedScore(results: CheckResult[]): { total: number; grade: string } {
  const remedied = new Set(catalog.checks.filter((c) => c.remedy).map((c) => c.key));
  const projected = results.map((r) => (remedied.has(r.key) && (r.status === 'fail' || r.status === 'warn') ? { ...r, status: 'pass' as const } : r));
  const s = scoreOf(projected);
  return { total: s.total, grade: s.grade };
}

export async function evidenceFor(scanId: string): Promise<CheckResult[]> {
  const { data } = await serviceClient().from('evidence').select('check_key, status, observed, duration_ms').eq('scan_id', scanId);
  return (data ?? []).map((row) => ({
    key: String(row.check_key),
    status: row.status as CheckResult['status'],
    observed: (row.observed ?? {}) as Record<string, unknown>,
    durationMs: Number(row.duration_ms ?? 0),
  }));
}

// ------------------------------------------------------------------ competitors

export interface CompetitorRow {
  id: string | null;
  siteId: string;
  domain: string;
  scanId: string | null;
  total: number | null;
  status: 'complete' | 'blocked' | 'pending' | 'none';
  agentsOk: { ok: number; of: number } | null;
  cited: { count: number; of: number };
  self: boolean;
}

export async function loadCompetitors(siteId: string, selfDomain: string, selfResults: CheckResult[], selfScore: ScoreDetail | null): Promise<CompetitorRow[]> {
  const supabase = serviceClient();
  const { data } = await supabase.from('competitors').select('id, competitor_site_id, sites:competitor_site_id(id, domain)').eq('site_id', siteId);
  const rows: CompetitorRow[] = [];
  const citations = await citationCounts(siteId);

  for (const raw of data ?? []) {
    const row = raw as unknown as { id: string; competitor_site_id: string; sites: { id: string; domain: string } | null };
    if (!row.sites) continue;
    rows.push(await competitorRow(row.id, row.sites.id, row.sites.domain, citations));
  }

  rows.push({
    id: null,
    siteId,
    domain: selfDomain,
    scanId: null,
    total: selfScore?.total ?? null,
    status: selfScore ? 'complete' : 'none',
    agentsOk: agentsOkOf(selfResults),
    cited: { count: citations.byDomain.get(selfDomain) ?? 0, of: citations.prompts },
    self: true,
  });

  return rows.sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
}

async function competitorRow(id: string, siteId: string, domain: string, citations: Citations): Promise<CompetitorRow> {
  const supabase = serviceClient();
  const { data: scans } = await supabase
    .from('scans')
    .select('id, status')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(3);
  const list = (scans ?? []) as Array<{ id: string; status: string }>;
  const finished = list.find((s) => s.status === 'complete' || s.status === 'blocked');
  let total: number | null = null;
  let agentsOk: CompetitorRow['agentsOk'] = null;
  if (finished?.status === 'complete') {
    const results = await evidenceFor(finished.id);
    if (results.length > 0) {
      total = scoreOf(results).total;
      agentsOk = agentsOkOf(results);
    }
  }
  return {
    id,
    siteId,
    domain,
    scanId: finished?.id ?? null,
    total,
    status: finished ? (finished.status === 'blocked' ? 'blocked' : 'complete') : list.length > 0 ? 'pending' : 'none',
    agentsOk,
    cited: { count: citations.byDomain.get(domain) ?? 0, of: citations.prompts },
    self: false,
  };
}

function agentsOkOf(results: CheckResult[]): { ok: number; of: number } | null {
  const parity = results.find((r) => r.key === 'agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const entries = Object.values(perAgent);
  if (entries.length === 0) return null;
  return { ok: entries.filter((f) => !f.transport_error && f.status >= 200 && f.status < 300).length, of: entries.length };
}

// ------------------------------------------------------------------ prompt watch

export interface PromptRow {
  id: string;
  text: string;
  createdAt: string;
  latest: { ranAt: string; cited: boolean; citedDomains: string[]; excerpt: string; model: string; error: string | null } | null;
}

interface Citations {
  prompts: number;
  /** How many prompts' latest run cited each domain. */
  byDomain: Map<string, number>;
}

export async function loadPrompts(siteId: string, selfDomain: string): Promise<PromptRow[]> {
  const supabase = serviceClient();
  const { data: prompts } = await supabase.from('prompts').select('id, text, created_at').eq('site_id', siteId).eq('is_active', true).order('created_at', { ascending: true });
  const list = (prompts ?? []) as Array<{ id: string; text: string; created_at: string }>;
  if (list.length === 0) return [];

  const { data: runs } = await supabase
    .from('prompt_runs')
    .select('prompt_id, ran_at, model, answer_excerpt, cited_domains, error')
    .in('prompt_id', list.map((p) => p.id))
    .order('ran_at', { ascending: false });
  const latestByPrompt = new Map<string, PromptRow['latest']>();
  for (const raw of runs ?? []) {
    const run = raw as { prompt_id: string; ran_at: string; model: string; answer_excerpt: string; cited_domains: string[]; error: string | null };
    if (latestByPrompt.has(run.prompt_id)) continue;
    const cited = Array.isArray(run.cited_domains) ? run.cited_domains : [];
    latestByPrompt.set(run.prompt_id, {
      ranAt: run.ran_at,
      cited: cited.some((d) => sameSite(d, selfDomain)),
      citedDomains: cited,
      excerpt: run.answer_excerpt,
      model: run.model,
      error: run.error,
    });
  }

  return list.map((p) => ({ id: p.id, text: p.text, createdAt: p.created_at, latest: latestByPrompt.get(p.id) ?? null }));
}

async function citationCounts(siteId: string): Promise<Citations> {
  const supabase = serviceClient();
  const { data: prompts } = await supabase.from('prompts').select('id').eq('site_id', siteId).eq('is_active', true);
  const ids = (prompts ?? []).map((p) => (p as { id: string }).id);
  const byDomain = new Map<string, number>();
  if (ids.length === 0) return { prompts: 0, byDomain };
  const { data: runs } = await supabase.from('prompt_runs').select('prompt_id, cited_domains, ran_at').in('prompt_id', ids).order('ran_at', { ascending: false });
  const seen = new Set<string>();
  for (const raw of runs ?? []) {
    const run = raw as { prompt_id: string; cited_domains: string[] };
    if (seen.has(run.prompt_id)) continue;
    seen.add(run.prompt_id);
    const domains = new Set((Array.isArray(run.cited_domains) ? run.cited_domains : []).map(rootOf));
    for (const d of domains) byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
  }
  return { prompts: ids.length, byDomain };
}

/** blog.example.com and example.com are the same site for citation purposes. */
export function sameSite(a: string, b: string): boolean {
  return rootOf(a) === rootOf(b);
}

function rootOf(domain: string): string {
  const parts = domain.toLowerCase().replace(/^www\./, '').split('.');
  // A two-label suffix like co.uk keeps three labels; everything else keeps two.
  const keep = parts.length >= 3 && /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2] ?? '') ? 3 : 2;
  return parts.slice(-keep).join('.');
}

// ------------------------------------------------------------------ page detail

export interface PageDetail {
  url: string;
  path: string;
  rawChars: number;
  renderedChars: number;
  ratio: number;
  rawExcerpt: string | null;
  renderedExcerpt: string | null;
  rows: Array<{ label: string; value: string; chip: string; ok: boolean }>;
}

/**
 * The target page's raw response against its rendered result. The scanner
 * compares the target page; the extra pages carry titles and status only, so
 * this is the one page the scan can show both sides of.
 */
export function pageDetail(url: string, results: CheckResult[]): PageDetail | null {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const ratio = byKey.get('js_dependency_ratio');
  if (!ratio) return null;
  const o = ratio.observed;
  const rawChars = Number(o.raw_chars ?? 0);
  const renderedChars = Number(o.rendered_chars ?? 0);
  const parity = byKey.get('agent_status_parity');
  const perAgent = (parity?.observed.per_agent ?? {}) as Record<string, PerAgentFetch>;
  const claude = perAgent.claudebot;
  const pricing = byKey.get('pricing_structured');
  const landmarks = byKey.get('semantic_landmarks');
  const lo = landmarks?.observed ?? {};
  const h1s = Number(lo.h1_count ?? lo.h1s ?? NaN);
  const skips = Number(lo.heading_skips ?? lo.skipped_levels ?? NaN);

  let path = '/';
  try {
    const u = new URL(url);
    path = `${u.pathname}${u.search}` || '/';
  } catch {
    /* keep the root */
  }

  const pct = renderedChars > 0 ? Math.round((rawChars / renderedChars) * 100) : 0;
  const rows: PageDetail['rows'] = [];
  if (claude) {
    rows.push({
      label: 'Status to ClaudeBot',
      value: 'same URL, same second',
      chip: claude.transport_error ? 'ERR' : String(claude.status),
      ok: !claude.transport_error && claude.status >= 200 && claude.status < 300,
    });
  }
  rows.push({
    label: 'Readable text without JavaScript',
    value: `${rawChars.toLocaleString('en-US')} of ${renderedChars.toLocaleString('en-US')} characters`,
    chip: `${pct}%`,
    ok: ratio.status === 'pass',
  });
  if (pricing && pricing.status !== 'skip') {
    const nodes = Number(pricing.observed.offer_nodes ?? 0);
    rows.push({ label: 'Offer schema', value: nodes > 0 ? `${nodes} Offer ${nodes === 1 ? 'node' : 'nodes'} found` : 'no ld+json block found', chip: nodes > 0 ? 'present' : 'missing', ok: nodes > 0 });
  }
  if (landmarks) {
    rows.push({
      label: 'Headings',
      value: Number.isFinite(h1s) ? `${h1s} h1${Number.isFinite(skips) ? `, ${skips === 0 ? 'no skips' : `${skips} skipped ${skips === 1 ? 'level' : 'levels'}`}` : ''}` : landmarks.status === 'pass' ? 'one h1, sane order, a main landmark' : 'see the finding',
      chip: landmarks.status === 'pass' ? 'clean' : landmarks.status === 'warn' ? 'warn' : 'fail',
      ok: landmarks.status === 'pass',
    });
  }

  return {
    url,
    path,
    rawChars,
    renderedChars,
    ratio: Number(o.ratio ?? 0),
    rawExcerpt: typeof o.raw_excerpt === 'string' ? o.raw_excerpt : null,
    renderedExcerpt: typeof o.rendered_excerpt === 'string' ? o.rendered_excerpt : null,
    rows,
  };
}
