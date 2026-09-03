/**
 * The check catalog is data, not code. Adding, retiring or reweighting a check
 * is an edit to checks.json, never a new branch in the scoring function.
 *
 * Weights are published on the site, so a change here is a versioned event.
 * When you change them:
 *   1. copy the current checks.json to catalogs/v<old>.json
 *   2. edit checks.json and bump scoringVersion
 *   3. add the archived file to CATALOGS below
 *   4. re-score history with the new version, keeping the old rows
 *
 * Step 3 is what lets `score(results, '1.2')` keep working after 1.3 ships,
 * which is the whole reason evidence and scoring are separate tables.
 */

import rawCatalog from '../checks.json';
import type { AgentDef, Catalog, CategoryDef, CategoryKey, CheckDef } from './types';

export const catalog = rawCatalog as unknown as Catalog;

/** Every catalog version this build can score against, newest first. */
export const CATALOGS: Record<string, Catalog> = {
  [catalog.scoringVersion]: catalog,
};

export const CURRENT_SCORING_VERSION = catalog.scoringVersion;

export class UnknownScoringVersionError extends Error {
  constructor(version: string) {
    super(
      `No catalog for scoring version ${version}. This build carries: ${Object.keys(CATALOGS)
        .sort()
        .join(', ')}. Archive the old checks.json under packages/core/catalogs and register it in CATALOGS.`,
    );
    this.name = 'UnknownScoringVersionError';
  }
}

export function catalogFor(version?: string): Catalog {
  if (!version) return catalog;
  const found = CATALOGS[version];
  if (!found) throw new UnknownScoringVersionError(version);
  return found;
}

// ------------------------------------------------------------------ lookups

const byKey = new Map<string, CheckDef>(catalog.checks.map((c) => [c.key, c]));
const categoryByKey = new Map<CategoryKey, CategoryDef>(
  catalog.categories.map((c) => [c.key, c]),
);
const agentById = new Map<string, AgentDef>(catalog.agents.map((a) => [a.id, a]));

export function checkDef(key: string): CheckDef | undefined {
  return byKey.get(key);
}

export function categoryDef(key: CategoryKey): CategoryDef | undefined {
  return categoryByKey.get(key);
}

export function agentDef(id: string): AgentDef | undefined {
  return agentById.get(id);
}

export const CHECK_KEYS: readonly string[] = catalog.checks.map((c) => c.key);
export const CATEGORY_KEYS: readonly CategoryKey[] = catalog.categories.map((c) => c.key);

/** The Chrome control, first. Everything is compared against this. */
export const CONTROL_AGENT: AgentDef = (() => {
  const control = catalog.agents.find((a) => a.role === 'control');
  if (!control) throw new Error('checks.json has no agent with role "control"');
  return control;
})();

export const AGENT_CLIENTS: readonly AgentDef[] = catalog.agents.filter(
  (a) => a.role === 'agent',
);

/** Total points available in a category, ignoring what any scan observed. */
export function categoryPoints(category: CategoryKey, version?: string): number {
  return catalogFor(version)
    .checks.filter((c) => c.category === category)
    .reduce((sum, c) => sum + c.points, 0);
}

export function checksInCategory(category: CategoryKey, version?: string): CheckDef[] {
  return catalogFor(version).checks.filter((c) => c.category === category);
}
