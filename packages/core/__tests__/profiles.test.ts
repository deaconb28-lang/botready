/**
 * Sector profiles: what a site is exempt from, and how it earns the exemption.
 *
 * The risk this file exists to police is circularity. An exemption that could
 * be earned by lacking the thing exempted would make the score a tautology —
 * every site would be exempt from everything it had not done. So the tests
 * below check not only that a plumber is spared `api_docs_reachable`, but that
 * a site which merely has no API docs is not.
 */

import { describe, expect, it } from 'vitest';

import { catalog } from '../src/catalog';
import { GENERAL, declaredTypes, inferProfile, profileFor, profiles } from '../src/profiles';
import { scoreDetail } from '../src/scoring';
import type { CheckResult } from '../src/types';

/** Every check passing, so the only thing moving a total is the profile. */
function allPassing(types: string[]): CheckResult[] {
  return catalog.checks.map((c) => ({
    key: c.key,
    status: 'pass' as const,
    observed: c.key === 'jsonld_present' ? { types } : {},
    durationMs: 1,
  }));
}

/** Every check passing except the ones a plumber has no business having. */
function plumberShaped(types: string[]): CheckResult[] {
  const missing = new Set(['api_docs_reachable', 'agent_manifest', 'no_wall_on_docs', 'pricing_structured']);
  return catalog.checks.map((c) => ({
    key: c.key,
    status: missing.has(c.key) ? ('fail' as const) : ('pass' as const),
    observed: c.key === 'jsonld_present' ? { types } : {},
    durationMs: 1,
  }));
}

describe('the catalog of profiles', () => {
  it('carries one, and general is first', () => {
    expect(profiles()[0]?.key).toBe('general');
  });

  it('exempts nothing under general', () => {
    expect(profileFor('general').exempt).toEqual([]);
  });

  it('only ever exempts a check that exists', () => {
    const known = new Set(catalog.checks.map((c) => c.key));
    for (const profile of profiles()) {
      for (const key of profile.exempt) expect(known, `${profile.key} exempts ${key}`).toContain(key);
    }
  });

  it('keeps every weight override summing to 100 over the real categories', () => {
    const categories = new Set(catalog.categories.map((c) => c.key));
    for (const profile of profiles()) {
      if (!profile.weights) continue;
      expect(Object.keys(profile.weights).sort(), profile.key).toEqual([...categories].sort());
      expect(Object.values(profile.weights).reduce((a, b) => a + b, 0), profile.key).toBe(100);
    }
  });

  it('never leaves a category with nothing left to measure', () => {
    // A category emptied by exemptions has its weight redistributed, which is
    // correct but silent. Better to notice here than to wonder later why a
    // sector's meter reads zero.
    for (const profile of profiles()) {
      const exempt = new Set(profile.exempt);
      for (const category of catalog.categories) {
        const left = catalog.checks.filter((c) => c.category === category.key && !exempt.has(c.key));
        expect(left.length, `${profile.key} empties ${category.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('names an unknown profile as general rather than throwing', () => {
    expect(profileFor('accountancy').key).toBe('general');
    expect(profileFor(null)).toBe(GENERAL);
  });
});

describe('reading what a site declared', () => {
  it('takes the types out of the jsonld evidence', () => {
    expect(declaredTypes(allPassing(['LocalBusiness', 'Plumber']))).toEqual(['localbusiness', 'plumber']);
  });

  it('strips a full schema.org URL, which is how some sites write it', () => {
    expect(declaredTypes(allPassing(['https://schema.org/Plumber']))).toEqual(['plumber']);
  });

  it('is empty when the site declared nothing', () => {
    expect(declaredTypes(allPassing([]))).toEqual([]);
    expect(declaredTypes([])).toEqual([]);
  });
});

describe('choosing a profile', () => {
  it('reads a plumber as a local service', () => {
    expect(inferProfile(allPassing(['LocalBusiness', 'Plumber'])).key).toBe('local-service');
  });

  it('reads a declared shop as ecommerce', () => {
    expect(inferProfile(allPassing(['OnlineStore'])).key).toBe('ecommerce');
  });

  it('does not read Product or Offer as a shop', () => {
    // The trap. A SaaS company declares Organization, Product and Offer, and
    // matching on those filed every site with a price on it as a retailer.
    expect(inferProfile(allPassing(['Organization', 'Product', 'Offer'])).key).toBe('general');
  });

  it('does not read WebPage as a publisher', () => {
    expect(inferProfile(allPassing(['WebPage'])).key).toBe('general');
  });

  it('leaves a site that declared nothing general', () => {
    // Silence is not a claim. Guessing in the site's favour would make the
    // number mean less for everyone who did the work.
    expect(inferProfile(allPassing([])).key).toBe('general');
  });

  it('never infers an exemption from the absence of the thing exempted', () => {
    // The circularity guard, stated as a test. A site with no API docs and no
    // manifest, declaring nothing, is measured on both.
    const noDocs = plumberShaped([]);
    const detail = scoreDetail(noDocs);
    expect(detail.profile.key).toBe('general');
    expect(detail.exemptChecks).toEqual([]);
    expect(detail.failedChecks).toContain('api_docs_reachable');
  });
});

describe('what a profile does to the arithmetic', () => {
  it('scores a plumber on the checks a plumber has', () => {
    const detail = scoreDetail(plumberShaped(['LocalBusiness', 'Plumber']));
    expect(detail.profile.key).toBe('local-service');
    expect(detail.exemptChecks.sort()).toEqual(
      ['agent_manifest', 'api_docs_reachable', 'no_wall_on_docs', 'pricing_structured'].sort(),
    );
    // Everything it was actually measured on passed, so it is a hundred.
    expect(detail.total).toBe(100);
  });

  it('scores the identical evidence lower when the site is not a local service', () => {
    const asPlumber = scoreDetail(plumberShaped(['LocalBusiness', 'Plumber'])).total;
    const asAnyone = scoreDetail(plumberShaped([])).total;
    expect(asAnyone).toBeLessThan(asPlumber);
  });

  it('counts an exemption as skipped, never as passed', () => {
    const detail = scoreDetail(plumberShaped(['Plumber']));
    for (const key of detail.exemptChecks) {
      expect(detail.skippedChecks).toContain(key);
      expect(detail.failedChecks).not.toContain(key);
    }
  });

  it('uses the profile weights when it has them', () => {
    const detail = scoreDetail(allPassing(['NewsMediaOrganization']));
    const freshness = detail.categories.find((c) => c.key === 'freshness');
    expect(detail.profile.key).toBe('media');
    // A publisher lives on being current, so freshness is doubled from 5.
    expect(freshness?.weight).toBe(10);
  });

  it('lets a caller name the profile, which is what re-scoring history needs', () => {
    const detail = scoreDetail(plumberShaped([]), undefined, 'local-service');
    expect(detail.profile.key).toBe('local-service');
    expect(detail.total).toBe(100);
  });

  it('scores every check under 1.2, which had no profiles', () => {
    const detail = scoreDetail(plumberShaped(['Plumber']), '1.2');
    expect(detail.profile.key).toBe('general');
    expect(detail.exemptChecks).toEqual([]);
    expect(detail.failedChecks).toContain('api_docs_reachable');
  });
});
