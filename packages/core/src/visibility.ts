import { rootDomain } from './domain';

/**
 * Share of voice, derived from what the engines actually said.
 *
 * The answer plane's equivalent of scoring.ts, and it follows the same rule
 * for the same reason. A probe emits observations: which domains an answer
 * cited, in what order, and whether the engine answered at all. None of those
 * is a number a customer reads. Every number a customer reads — share of
 * voice, mention rate, average position — is this pure function over those
 * observations, carrying its own version, so the whole history can be
 * recomputed when the method changes. Constraint 2.
 *
 * What this deliberately does not do is ask a model who the market leader is
 * and write the answer down as a fact. Constraint 8: an engine's answer is
 * evidence about the engine. So the only thing counted here is whether a
 * domain was cited, which is an observable property of the response rather
 * than an opinion inside it. "Perplexity cited you in 4 of 12 answers" is a
 * measurement. "Perplexity thinks you are the best option" is not, and no
 * amount of prompt engineering turns the second into the first.
 *
 * The rival set is the customer's own competitor list rather than every domain
 * that ever appeared. An open denominator makes share of voice meaningless —
 * a category with a Wikipedia page and two review sites in it dilutes everyone
 * equally and moves for reasons nobody can act on.
 */

export const VISIBILITY_VERSION = '1.0';

/** One answer, as the prober recorded it. Facts only. */
export interface RunObservation {
  promptId: string;
  engineId: string;
  /** Root domains the answer cited, in the order they first appeared. */
  citedDomains: string[];
  /** Set when the engine refused or failed. Such a run is not a zero. */
  error?: string | null;
  ranAt?: string;
}

export interface RivalShare {
  domain: string;
  /** Answers that cited this domain. */
  citations: number;
  /** Of the tracked citations in this window, the percentage that were theirs. */
  shareOfVoice: number;
  /** Mean 1-based position among cited domains, over the answers that cited it. */
  averagePosition: number | null;
}

export interface Visibility {
  /** Prompts we asked, counting one per prompt per engine. */
  runs: number;
  /** Runs that produced an answer. A refusal is not a zero, it is not a run. */
  answered: number;
  /** Answers that cited the customer. */
  citations: number;
  /** Of the answers we could read, the percentage that cited the customer. */
  mentionRate: number;
  /** The customer's share of every tracked citation, self and rivals together. */
  shareOfVoice: number;
  /** Mean 1-based position among cited domains, over the answers that cited them. */
  averagePosition: number | null;
  /** Rivals, best first. Only the domains the customer chose to track. */
  rivals: RivalShare[];
  /** Engines that contributed, so a number is never quietly one engine's. */
  engines: string[];
  visibilityVersion: string;
}

export interface VisibilityInput {
  /** The customer's domain. */
  self: string;
  /** The domains they are tracking against. May be empty. */
  rivals: string[];
  runs: RunObservation[];
}

/**
 * Pure. No I/O, no clock, no database.
 *
 * Returns zeroes rather than throwing on an empty window, because "we asked
 * nothing yet" and "we asked and nobody cited you" are different states that
 * the caller has to be able to tell apart — `runs` is how.
 */
export function visibility(input: VisibilityInput, version: string = VISIBILITY_VERSION): Visibility {
  const self = rootDomain(input.self);
  const rivals = dedupe(input.rivals.map(rootDomain).filter((d) => d && d !== self));
  const tracked = [self, ...rivals];

  // A refusal or an API failure is excluded from both halves. Counting it as
  // an answer that did not cite the customer would let an outage look like a
  // collapse in visibility, which is the one reading nobody could act on.
  const answered = input.runs.filter((r) => !r.error);

  const positions = new Map<string, number[]>();
  for (const domain of tracked) positions.set(domain, []);

  for (const run of answered) {
    // One citation per domain per answer. An answer that names a site three
    // times is one answer that named it.
    const cited = dedupe(run.citedDomains.map(rootDomain));
    let rank = 0;
    for (const domain of cited) {
      rank += 1;
      const seen = positions.get(domain);
      if (seen) seen.push(rank);
    }
  }

  const countOf = (domain: string) => positions.get(domain)?.length ?? 0;
  const meanPosition = (domain: string) => {
    const seen = positions.get(domain) ?? [];
    return seen.length > 0 ? round(seen.reduce((a, b) => a + b, 0) / seen.length, 2) : null;
  };

  const trackedCitations = tracked.reduce((sum, d) => sum + countOf(d), 0);
  const mine = countOf(self);

  return {
    runs: input.runs.length,
    answered: answered.length,
    citations: mine,
    mentionRate: answered.length > 0 ? round((mine / answered.length) * 100, 1) : 0,
    shareOfVoice: trackedCitations > 0 ? round((mine / trackedCitations) * 100, 1) : 0,
    averagePosition: meanPosition(self),
    rivals: rivals
      .map((domain) => ({
        domain,
        citations: countOf(domain),
        shareOfVoice: trackedCitations > 0 ? round((countOf(domain) / trackedCitations) * 100, 1) : 0,
        averagePosition: meanPosition(domain),
      }))
      .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain)),
    engines: dedupe(input.runs.map((r) => r.engineId)).sort(),
    visibilityVersion: version,
  };
}

/**
 * The same measurement over successive windows, oldest first, for a trend.
 *
 * The caller decides what a window is — a week, a cycle — because that is a
 * product decision about cadence and cadence is priced. This only groups.
 */
export function visibilityOver(
  input: Omit<VisibilityInput, 'runs'>,
  windows: Array<{ label: string; runs: RunObservation[] }>,
  version: string = VISIBILITY_VERSION,
): Array<{ label: string } & Visibility> {
  return windows.map((w) => ({ label: w.label, ...visibility({ ...input, runs: w.runs }, version) }));
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)].filter(Boolean);
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
