/**
 * Prompt watch: ask an answer engine a buyer's question and record which
 * domains its answer cited.
 *
 * What is stored is the model's own answer, labelled as the model's words,
 * and the list of domains it cited. That is a measurement of the answer
 * engine, not a fact about the site, and the interface never presents it as
 * one. The model is not asked anything about the site itself, and nothing it
 * says is copied into a finding, a score or a generated file.
 *
 * Opt-in: without ANTHROPIC_API_KEY the probe reports that it is not
 * configured and no run is written.
 */

import Anthropic from '@anthropic-ai/sdk';

import { serverEnv } from './env';

export const PROBE_MODEL = 'claude-opus-5';

export interface ProbeOutcome {
  model: string;
  /** The answer, cut to a few hundred characters. */
  excerpt: string;
  /** Root domains the answer cited, in the order they first appeared. */
  citedDomains: string[];
  error: string | null;
}

const SYSTEM =
  'You are a general-purpose assistant. A person is asking you for a recommendation the way they would ask any assistant. ' +
  'Answer the question directly and briefly, naming the specific products or sites you would point them to, and search the web first so your answer reflects what is actually out there. ' +
  'Do not mention that you have been asked to search or that this is a test.';

export function probeConfigured(): boolean {
  return Boolean(serverEnv.anthropicApiKey());
}

export async function probePrompt(prompt: string): Promise<ProbeOutcome> {
  const apiKey = serverEnv.anthropicApiKey();
  if (!apiKey) {
    return { model: PROBE_MODEL, excerpt: '', citedDomains: [], error: 'ANTHROPIC_API_KEY is not set, so prompts are not being asked.' };
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: PROBE_MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      return { model: response.model, excerpt: '', citedDomains: [], error: 'The model declined to answer this prompt.' };
    }

    const text: string[] = [];
    const cited: string[] = [];
    const searched: string[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text.push(block.text);
        for (const c of block.citations ?? []) {
          if ('url' in c && typeof c.url === 'string') push(cited, c.url);
        }
      } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === 'web_search_result') push(searched, r.url);
        }
      }
    }

    const answer = text.join('\n').trim();
    // Citations are the authoritative signal. When the model cited nothing
    // explicitly, a domain it named in the text and had searched counts.
    const domains = cited.length > 0 ? cited : searched.filter((d) => answer.toLowerCase().includes(d.toLowerCase()));

    return {
      model: response.model,
      excerpt: answer.length > 600 ? `${answer.slice(0, 597).trimEnd()}…` : answer,
      citedDomains: [...new Set(domains)],
      error: null,
    };
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? `${err.status ?? ''} ${err.message}`.trim() : err instanceof Error ? err.message : String(err);
    return { model: PROBE_MODEL, excerpt: '', citedDomains: [], error: `The prompt could not be asked: ${message}` };
  }
}

function push(list: string[], url: string): void {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host && !list.includes(host)) list.push(host);
  } catch {
    /* not a URL */
  }
}
