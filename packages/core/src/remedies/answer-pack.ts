import type { CheckResult } from '../types';

import { readFacts, type FixFile } from './index';
import { buildFaq } from './faq';
import { buildFit } from './fit';
import { buildCorroboration } from './corroboration';

/**
 * The answer pack: three files about being recommended rather than being read.
 *
 * The fix pack solves access. Every file in it exists so a client can fetch the
 * page and parse what comes back, and a site can pass all of it and still never
 * be named, because being readable is not the same as being the answer. An
 * assistant asked for "a tracker for five people under $10 a seat" is matching
 * constraints, and it can only match constraints that are stated as facts.
 *
 * So: answers.html states the questions, fit.html states the facts a constraint
 * query is made of, and corroboration.md covers the part that is not on the
 * customer's server at all.
 *
 * Built separately from buildFixPack rather than folded into it, because
 * whether these ship inside the $15 pack or above it is a pricing decision and
 * not one this function should make by being called.
 *
 * The rule from index.ts holds throughout and is the reason two of these three
 * files are mostly blanks: no model touches a fact, and a scan sees URLs,
 * titles, descriptions and statuses. It does not see the sentence that answers
 * "how much does it cost", so it does not write one.
 */
export function buildAnswerPack(domain: string, results: CheckResult[]): FixFile[] {
  const facts = readFacts(results);
  return [buildFaq(domain, facts), buildFit(domain, facts), buildCorroboration(domain, facts)];
}
