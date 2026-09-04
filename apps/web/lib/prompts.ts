/**
 * Running the watched prompts for a site and recording each answer.
 */

import { probePrompt } from './prompt-probe';
import { serviceClient } from './supabase';

export interface RunSummary {
  asked: number;
  cited: number;
  errors: number;
}

export async function runPromptsForSite(siteId: string, selfDomain: string): Promise<RunSummary> {
  const supabase = serviceClient();
  const { data: prompts } = await supabase.from('prompts').select('id, text').eq('site_id', siteId).eq('is_active', true);
  const list = (prompts ?? []) as Array<{ id: string; text: string }>;
  let cited = 0;
  let errors = 0;

  for (const prompt of list) {
    const outcome = await probePrompt(prompt.text);
    if (outcome.error) errors += 1;
    if (outcome.citedDomains.some((d) => sameRoot(d, selfDomain))) cited += 1;
    await supabase.from('prompt_runs').insert({
      prompt_id: prompt.id,
      model: outcome.model,
      answer_excerpt: outcome.excerpt,
      cited_domains: outcome.citedDomains,
      error: outcome.error,
    });
  }

  return { asked: list.length, cited, errors };
}

function sameRoot(a: string, b: string): boolean {
  const root = (d: string) => d.toLowerCase().replace(/^www\./, '').split('.').slice(-2).join('.');
  return root(a) === root(b);
}
