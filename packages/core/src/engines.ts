import raw from '../engines.json';

/**
 * The answer engines we ask, as data.
 *
 * Constraint 3: adding an engine is an edit to engines.json, never a new
 * branch in the prober. Three of the four are declared and not live, which is
 * the point of writing the catalog before the code that needs it — the shape
 * of "a second engine" is fixed now, while there is one, rather than being
 * invented under deadline when a customer asks why we only ask Claude.
 *
 * `live` is whether we ask it at all. It is deliberately not the same question
 * as whether its key is set: an engine can be built and switched off, and an
 * engine can be declared here with no adapter written yet. The prober checks
 * both and says which one is missing.
 *
 * `costPerRunUsd` is here because it is the recurring cost of goods and
 * constraint 10 makes it a pricing input rather than a footnote. A tier that
 * asks 50 questions a week across three engines is 650 runs a month, and the
 * price has to clear that before margin.
 */
export interface EngineDef {
  id: string;
  label: string;
  vendor: string;
  model: string;
  /** The environment variable holding this engine's key. */
  keyEnv: string;
  webSearch: boolean;
  live: boolean;
  costPerRunUsd: number;
}

interface EngineCatalog {
  enginesVersion: string;
  engines: EngineDef[];
}

const catalog = raw as EngineCatalog;

export const ENGINES_VERSION = catalog.enginesVersion;
export const ENGINES: readonly EngineDef[] = catalog.engines;

/** The engines we actually ask today. */
export const LIVE_ENGINES: readonly EngineDef[] = catalog.engines.filter((e) => e.live);

export function engineDef(id: string): EngineDef | undefined {
  return catalog.engines.find((e) => e.id === id);
}

/**
 * What one cycle costs to run, in dollars.
 *
 * Exported so a pricing decision can be checked against it in a test rather
 * than in somebody's head. See PLAN_LIMITS in the web app.
 */
export function cycleCostUsd(prompts: number, engineIds: readonly string[] = LIVE_ENGINES.map((e) => e.id)): number {
  return engineIds.reduce((sum, id) => sum + prompts * (engineDef(id)?.costPerRunUsd ?? 0), 0);
}
