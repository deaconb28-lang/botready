/**
 * Which sector a site is measured as, and what that exempts it from.
 *
 * The problem this solves: a plumber scored against `api_docs_reachable` and
 * `agent_manifest` loses points for not being a software company. The fix is
 * not to weaken those checks — a dev tool with no manifest really is harder
 * for an agent to use — but to stop asking them of sites they were never
 * written for.
 *
 * The inference is deliberately one-directional. A profile is selected by a
 * site *declaring* what it is, in JSON-LD, using schema.org's own vocabulary.
 * It is never selected by the absence of the thing being exempted, because
 * "no API docs, therefore exempt from API docs" hands every site a free pass
 * and turns the score into a tautology.
 *
 * A site that declares nothing gets `general`, which exempts nothing. Silence
 * is not a claim, and guessing in the site's favour would make the number mean
 * less for everybody who did the work.
 */

import { catalogFor } from './catalog';
import type { Catalog, CheckResult, ProfileDef } from './types';

export const GENERAL: ProfileDef = {
  key: 'general',
  label: 'General',
  match: [],
  exempt: [],
};

/** Every profile in a catalog. Empty for anything archived before 1.3. */
export function profiles(version?: string): ProfileDef[] {
  return catalogFor(version).profiles ?? [];
}

export function profileFor(key: string | null | undefined, version?: string): ProfileDef {
  if (!key) return GENERAL;
  return profiles(version).find((p) => p.key === key) ?? GENERAL;
}

/**
 * The types a site declared about itself, lowercased for comparison.
 *
 * Read from the `jsonld_present` evidence, which records what was found rather
 * than what it meant — the split the whole architecture rests on.
 */
export function declaredTypes(results: CheckResult[]): string[] {
  const observed = results.find((r) => r.key === 'jsonld_present')?.observed ?? {};
  const raw = (observed as { types?: unknown }).types;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().replace(/^https?:\/\/schema\.org\//i, '').toLowerCase())
    .filter(Boolean);
}

/**
 * The profile a scan's own evidence selects.
 *
 * First match in catalog order wins, and the catalog lists the narrow sectors
 * before the broad ones, so a site declaring both `Plumber` and the generic
 * `WebPage` is read as the plumber. A site declaring nothing recognised stays
 * general.
 */
export function inferProfile(results: CheckResult[], version?: string): ProfileDef {
  const declared = new Set(declaredTypes(results));
  if (declared.size === 0) return GENERAL;

  for (const profile of profiles(version)) {
    if (profile.match.some((type) => declared.has(type.toLowerCase()))) return profile;
  }
  return GENERAL;
}

/** The category weights to score with: the profile's, or the catalog's. */
export function weightsFor(profile: ProfileDef, cat: Catalog): Record<string, number> {
  if (profile.weights) return profile.weights;
  return Object.fromEntries(cat.categories.map((c) => [c.key, c.weight]));
}
