/**
 * The core contracts. Every consumer — the worker, the web app, the tests —
 * agrees on these shapes. Changing one means updating every consumer in the
 * same commit.
 *
 * The load-bearing rule: `observed` holds facts and the scanner never writes a
 * judgement into it. `{"status_code": 403, "server": "cloudflare"}` is a fact.
 * `{"blocked": true}` is a judgement, and the judgement is the `status` field.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'error' | 'skip';

export type CategoryKey =
  | 'retrievability'
  | 'discovery'
  | 'representation'
  | 'structure'
  | 'actionability'
  | 'freshness';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CheckResult {
  /** Must exist in checks.json. Enforced by a test that iterates the catalog. */
  key: string;
  status: CheckStatus;
  /** Raw facts only: status codes, header values, byte counts, character counts. */
  observed: Record<string, unknown>;
  durationMs: number;
}

export interface ScanScore {
  /** 0 to 100, rounded once at the end. */
  total: number;
  grade: Grade;
  /** 0 to 100 per category, rounded for display. */
  categoryScores: Record<CategoryKey, number>;
  /** Keys that returned `fail`. */
  failedChecks: string[];
  /**
   * Keys that returned `error`. These score as a fail but are listed apart so
   * the interface can say the check could not run rather than implying the
   * site failed it.
   */
  erroredChecks: string[];
  /** Keys that returned `skip`, or that produced no result at all. */
  skippedChecks: string[];
  scoringVersion: string;
}

// ------------------------------------------------------------------ catalog

export interface GradeBand {
  grade: Grade;
  min: number;
}

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  /** Percentage points of the total. The six weights sum to 100. */
  weight: number;
}

export type AgentRole = 'control' | 'agent';

export interface AgentDef {
  id: string;
  ua: string;
  role: AgentRole;
}

export interface CheckDef {
  key: string;
  category: CategoryKey;
  points: number;
  label: string;
  fails_when?: string;
  warns_when?: string;
  observed_shape?: Record<string, unknown>;
  /** Key into the remedy generators. Absent when there is nothing to generate. */
  remedy?: string;
}

export interface Catalog {
  scoringVersion: string;
  grades: GradeBand[];
  categories: CategoryDef[];
  agents: AgentDef[];
  checks: CheckDef[];
}

// ------------------------------------------------------------------ evidence

/** One row of the `evidence` table, as the web app reads it back. */
export interface EvidenceRow {
  scan_id: string;
  check_key: string;
  status: CheckStatus;
  observed: Record<string, unknown>;
  duration_ms: number | null;
}

export type ScanStatus = 'queued' | 'running' | 'complete' | 'blocked' | 'error';
export type ScanTrigger = 'manual' | 'cron' | 'monitor' | 'index';

export interface ScanRow {
  id: string;
  site_id: string;
  url: string;
  status: ScanStatus;
  trigger: ScanTrigger;
  scanner_version: string | null;
  pages_crawled: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface SiteRow {
  id: string;
  domain: string;
  first_seen_at: string;
  is_claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  segment: string | null;
}

export interface ScoreRow {
  scan_id: string;
  scoring_version: string;
  total: number;
  grade: Grade;
  category_scores: Record<CategoryKey, number>;
  failed_checks: string[];
  created_at: string;
}

// ------------------------------------------------------------------ observed shapes
//
// The scanner writes these into `observed`. They are typed here so both sides
// read the same facts out, and so a rename breaks the build rather than the
// result page.

export interface PerAgentFetch {
  status: number;
  /** Empty string when the header is absent, so the shape is stable in jsonb. */
  server: string;
  cf_mitigated: string;
  ttfb_ms: number;
  total_ms: number;
  bytes: number;
  redirects: number;
  content_type: string;
  /** Set when the request never produced a response at all. */
  transport_error?: string;
}

export interface AgentStatusParityObserved {
  control: string;
  per_agent: Record<string, PerAgentFetch>;
}

export interface JsDependencyObserved {
  raw_chars: number;
  rendered_chars: number;
  ratio: number;
}

export interface RobotsAgentRulesObserved {
  robots_status: number;
  search_crawlers_allowed: boolean;
  per_agent: Record<string, { allowed: boolean; matched_rule: string }>;
}

export interface SitemapObserved {
  status: number;
  url_count: number;
  has_lastmod: boolean;
  /** Up to 200 URLs, enough to build llms.txt without storing a whole site map. */
  urls: Array<{ loc: string; lastmod: string | null }>;
}

export interface LlmsTxtObserved {
  status: number;
  link_count: number;
  broken_links: string[];
  /**
   * True when the path answered 200 with the site's HTML shell rather than a
   * markdown file. Sites that answer every path with 200 are common enough that
   * "it returned 200" is not the same fact as "llms.txt exists".
   */
  served_html?: boolean;
}
