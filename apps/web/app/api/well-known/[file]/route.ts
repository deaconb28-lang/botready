import { NextResponse } from 'next/server';

import { PUBLIC_PAGES, httpDate, markdownPathFor, newestUpdate } from '@/lib/content';
import { CRAWLER_EMAIL, LIMITS, PRICING, SITE, USER_AGENT, absoluteUrl } from '@/lib/site';

/**
 * The `.well-known` manifests, served through a rewrite because a route segment
 * beginning with a dot is not a thing the App Router will build.
 *
 * Two of them, both real. `agent.json` describes what a client can do here and
 * where the readable text is; `ai-plugin.json` is the older manifest and points
 * at the same OpenAPI description. Neither is invented: everything they claim
 * is served by a route in this app, and a test asserts that.
 */
export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ file: 'agent.json' }, { file: 'ai-plugin.json' }];
}

function agentManifest() {
  return {
    schema_version: 'v1',
    name_for_human: 'BotReady',
    name_for_model: 'botready',
    description_for_human: 'Check whether a website is legible to AI agents, and generate the files that fix it.',
    description_for_model:
      'Scores a website on how readable it is to non-browser clients. POST a URL to /api/scan, poll GET /api/scan/{id} until settled is true, then read score.total and score.failedChecks.',
    url: SITE.origin,
    contact_email: CRAWLER_EMAIL,
    legal_info_url: absoluteUrl('/bot'),
    api: {
      type: 'openapi',
      url: absoluteUrl('/openapi.json'),
      is_user_authenticated: false,
    },
    documentation_url: absoluteUrl('/docs'),
    text_alternatives: {
      llms_txt: absoluteUrl('/llms.txt'),
      llms_full_txt: absoluteUrl('/llms-full.txt'),
      accept_header: 'text/markdown',
      pages: PUBLIC_PAGES.filter((p) => p.listed).map((p) => ({
        url: absoluteUrl(p.path),
        markdown: absoluteUrl(markdownPathFor(p.path)),
        title: p.title,
        updated: p.updated,
      })),
    },
    pricing: {
      diagnosis: 'free',
      fix_pack: { amount: PRICING.fixpack.amount, currency: PRICING.fixpack.currency, cadence: PRICING.fixpack.cadence },
      monitoring: { amount: PRICING.monitor.amount, currency: PRICING.monitor.currency, cadence: PRICING.monitor.cadence },
    },
    crawler: {
      user_agent: USER_AGENT,
      robots_token: 'BotreadyBot',
      max_pages_per_scan: LIMITS.maxPagesPerScan,
      page_delay_ms: LIMITS.pageDelayMs,
      evades_blocks: false,
    },
  };
}

function aiPluginManifest() {
  const agent = agentManifest();
  return {
    schema_version: agent.schema_version,
    name_for_human: agent.name_for_human,
    name_for_model: agent.name_for_model,
    description_for_human: agent.description_for_human,
    description_for_model: agent.description_for_model,
    auth: { type: 'none' },
    api: { type: 'openapi', url: agent.api.url },
    logo_url: absoluteUrl('/icon.svg'),
    contact_email: agent.contact_email,
    legal_info_url: agent.legal_info_url,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;

  const body =
    file === 'agent.json' ? agentManifest() : file === 'ai-plugin.json' ? aiPluginManifest() : null;

  if (!body) {
    return NextResponse.json({ error: 'No such manifest.' }, { status: 404 });
  }

  return NextResponse.json(body, {
    headers: {
      'last-modified': httpDate(newestUpdate()),
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
