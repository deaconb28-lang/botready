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
  /** Why this is measured and why it is worth what it is worth. Published. */
  rationale?: string;
}

export type AgentRole = 'control' | 'agent';

export interface AgentDef {
  id: string;
  ua: string;
  role: AgentRole;
}

/**
 * A sector, and what it is measured on.
 *
 * A plumber has no API to document and no agent manifest to publish, and
 * scoring one against those is scoring it against somebody else's business.
 * `exempt` drops those checks out of the denominator entirely — not a zero, an
 * absence — and `weights` lets the categories that are left carry what the
 * exempt ones gave up.
 *
 * `match` holds schema.org types. The profile is earned by a site declaring
 * what it is, never inferred from the absence of the thing being exempted:
 * "you have no API docs, so you need none" is circular and would hand every
 * site a free pass.
 */
export interface ProfileDef {
  key: string;
  label: string;
  /** schema.org @type values that select this profile. */
  match: string[];
  /** Check keys this sector is not measured on. */
  exempt: string[];
  /** Optional replacement category weights. Must still sum to 100. */
  weights?: Record<CategoryKey, number>;
  rationale?: string;
}

export interface CheckDef {
  key: string;
  category: CategoryKey;
  /**
   * This check's share *within its category*, not its share of the final 100.
   * `effectivePoints()` converts. Everything published to a reader goes
   * through that function; see the note on it for why.
   */
  points: number;
  /** Why this is measured and why it is worth what it is worth. Published. */
  rationale?: string;
  label: string;
  fails_when?: string;
  warns_when?: string;
  observed_shape?: Record<string, unknown>;
  /**
   * A failure here makes the rest of the report moot rather than merely worse:
   * the page could not be retrieved, or could not be read once retrieved. The
   * result page hoists these above the score.
   */
  critical?: boolean;
  /** Key into the remedy generators. Absent when there is nothing to generate. */
  remedy?: string;
}

export interface Catalog {
  scoringVersion: string;
  grades: GradeBand[];
  categories: CategoryDef[];
  agents: AgentDef[];
  checks: CheckDef[];
  /** Absent in catalogs archived before 1.3, which had no sector profiles. */
  profiles?: ProfileDef[];
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
export type ScanTrigger = 'manual' | 'cron' | 'monitor' | 'index' | 'competitor';

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
  /** The opening of the readable text on each side, from scanner 1.1.0 on. */
  raw_excerpt?: string;
  rendered_excerpt?: string;
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

/**
 * One page the scan actually fetched, recorded by `title_meta_distinct`. The
 * fix pack builds llms.txt from these, and only from the ones with a 2xx
 * status, so that a generated file never names a URL we did not see work.
 */
export interface ObservedPage {
  url: string;
  status: number;
  title: string;
  description: string;
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
