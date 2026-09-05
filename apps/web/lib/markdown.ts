/**
 * The markdown representation of every public page.
 *
 * This is the thing `markdown_alternate` and `content_negotiation` are asking
 * for, and the reason both checks exist: a client that wants the words should
 * not have to run a browser and then strip tags to get them. Every page here is
 * generated from the same data the HTML renders, so the two cannot disagree.
 */

import { catalog, checksInCategory, effectivePoints } from '@botready/core';

import { PUBLIC_PAGES, markdownPathFor, pageFor } from './content';
import { CONTACT_EMAIL, LIMITS, PRICING, PUBLIC_INDEX_LISTED, SITE, USER_AGENT, absoluteUrl } from './site';

function heading(path: string): string[] {
  const page = pageFor(path);
  if (!page) return [];
  return [`# ${page.title}`, '', page.description, '', `Source: ${absoluteUrl(path)}`, `Updated: ${page.updated}`, ''];
}

function home(): string {
  return [
    ...heading('/'),
    '## What it does',
    '',
    'You give botready.dev a URL. It requests that URL as five different clients — Chrome as the control, then',
    'ClaudeBot, GPTBot, PerplexityBot and our own crawler — one second apart from the same IP, and compares what',
    'each one gets back. The headline finding is a site that answers 200 to a browser and 403 to a reading agent',
    'in the same second, which is almost always an accident nobody decided on.',
    '',
    '## What it measures',
    '',
    `${catalog.checks.length} checks across ${catalog.categories.length} categories, scoring version ${catalog.scoringVersion}. The weights are published:`,
    '',
    ...catalog.categories.map((c) => `- **${c.label}** — ${c.weight} of the 100. ${c.rationale ?? ''}`.trimEnd()),
    '',
    '## What it costs',
    '',
    `The diagnosis is free and never blurred. The fix pack is ${PRICING.fixpack.label} ${PRICING.fixpack.cadence};`,
    `monitoring is ${PRICING.monitor.label} ${PRICING.monitor.cadence}.`,
    '',
    '## Limits we hold ourselves to',
    '',
    `- At most ${LIMITS.maxPagesPerScan} pages per scan, sequential, ${LIMITS.pageDelayMs}ms apart.`,
    '- robots.txt is read first and obeyed. If it disallows us, the scan ends there.',
    '- We never spoof a user agent, use a residential proxy, or solve a captcha to get past a block. A block is a finding, not an obstacle.',
    '',
    '## Elsewhere',
    '',
    ...PUBLIC_PAGES.filter((p) => p.listed && p.path !== '/').map(
      (p) => `- [${p.title}](${absoluteUrl(p.path)}): ${p.description}`,
    ),
    '',
  ].join('\n');
}

function whatWeCheck(): string {
  const lines = [
    ...heading('/what-we-check'),
    'A category is worth its weight out of 100. The checks inside it split that weight between them, and the number',
    'beside each check below is exactly what failing it takes off the score — the same number the findings list on a',
    'result prints back. A pass earns all of it, a warn earns half, a fail and an error earn none, and a check we',
    'could not run leaves the denominator rather than counting as a zero.',
    '',
    '## The clients',
    '',
    ...catalog.agents.map((a) => `- \`${a.id}\` (${a.role}) — \`${a.ua}\``),
    '',
    '## The checks',
    '',
  ];

  for (const category of catalog.categories) {
    lines.push(`### ${category.label} — ${category.weight} of the 100`, '');
    if (category.rationale) lines.push(category.rationale, '');
    for (const check of checksInCategory(category.key)) {
      lines.push(`#### ${check.label} (\`${check.key}\`) — ${effectivePoints(check.key).toFixed(1).replace(/\.0$/, '')} of the 100`, '');
      if (check.rationale) lines.push(check.rationale, '');
      if (check.fails_when) lines.push(`Fails when ${check.fails_when}.`, '');
      if (check.warns_when) lines.push(`Warns when ${check.warns_when}.`, '');
    }
  }

  lines.push(
    '## On the weights',
    '',
    'They are our estimates. They have not yet been measured against whether a site actually gets cited, we are',
    'collecting that evidence now, and we will publish it alongside whatever it says about these numbers before we',
    'change them. Changing any of them is a versioned event: every score records the version that produced it.',
    '',
  );
  return lines.join('\n');
}

function pricing(): string {
  return [
    ...heading('/pricing'),
    '## Free',
    '',
    'The full diagnosis. Every check, every status, every piece of evidence, and the comparison between what each',
    'client got back. Nothing is blurred and nothing is held back — you can act on all of it without paying us.',
    '',
    `## Fix pack — ${PRICING.fixpack.label} ${PRICING.fixpack.cadence}`,
    '',
    'The generated files for one scan: an llms.txt built from the URLs the scan confirmed return 200, a robots.txt',
    'patch, a WAF rule that stops refusing reading agents, the JSON-LD your pages are missing, and a prompt you can',
    'hand to a coding agent to apply the rest.',
    '',
    `## Monitoring — ${PRICING.monitor.label} ${PRICING.monitor.cadence}`,
    '',
    `Up to three claimed domains, re-scanned on a schedule, with an email the moment a client that could read you`,
    'stops being able to. That regression is the one this product exists to catch, and it is silent by nature.',
    '',
    '## Refunds',
    '',
    'If the fix pack is wrong about your site, write to us and we refund it. We would rather hear about the bad',
    'scan than keep fifteen dollars.',
    '',
  ].join('\n');
}

function bot(): string {
  return [
    ...heading('/bot'),
    '## Our user agent',
    '',
    '```',
    USER_AGENT,
    '```',
    '',
    '## What we request',
    '',
    '1. `GET /robots.txt` — first, always. If it disallows us, the scan ends there.',
    '2. The target page, once as each client in the catalog, sequentially.',
    '3. `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` and four `.well-known` manifests.',
    `4. Up to ${LIMITS.maxPagesPerScan - 1} further pages linked from the target, ${LIMITS.pageDelayMs}ms apart.`,
    '',
    '## What we never do',
    '',
    '- Spoof a browser user agent to get past a block.',
    '- Use a residential proxy or rotate IPs.',
    '- Solve or bypass a captcha or a JavaScript challenge.',
    '- Submit a form, sign in, or send anything that changes state.',
    '',
    'A block is the finding. Working around one would destroy the only thing the number is worth.',
    '',
    '## How to block us',
    '',
    '```',
    'User-agent: BotreadyBot',
    'Disallow: /',
    '```',
    '',
    `We read that on every scan and stop. Questions: ${CONTACT_EMAIL}.`,
    '',
  ].join('\n');
}

function docs(): string {
  return [
    ...heading('/docs'),
    '## Start a scan',
    '',
    '```http',
    `POST ${SITE.origin}/api/scan`,
    'content-type: application/json',
    '',
    '{ "url": "https://example.com" }',
    '```',
    '',
    'Returns `{ "scanId": "...", "cached": false, "domain": "example.com" }`. A result less than',
    `${LIMITS.cacheHours} hours old is returned instead of crawling again, with \`cached: true\`.`,
    '',
    '## Read a scan',
    '',
    '```http',
    `GET ${SITE.origin}/api/scan/{scanId}`,
    '```',
    '',
    'Returns `status`, `scannerVersion`, `pagesCrawled`, a `progress` array of `{ key, status }` as checks land, and',
    'once `settled` is true a `score` object of `{ total, grade, scoringVersion, categoryScores, failedChecks,',
    'erroredChecks, skippedChecks }`.',
    '',
    '## Rate limits',
    '',
    `- ${LIMITS.anonymousScansPerHour} scans an hour without an account, ${LIMITS.signedInScansPerHour} with one.`,
    '- `429` carries `retry-after` and the `x-ratelimit-*` headers.',
    '',
    '## Machine-readable files this site serves',
    '',
    ...PUBLIC_PAGES.filter((p) => p.listed).map((p) => `- \`${markdownPathFor(p.path)}\` — ${p.title}, as markdown.`),
    '- `/llms.txt` and `/llms-full.txt`',
    '- `/openapi.json` — the two endpoints above, as OpenAPI 3.1.',
    '- `/.well-known/agent.json` and `/.well-known/ai-plugin.json`',
    '- `/sitemap.xml` and `/robots.txt`',
    '',
    'Every page also answers `Accept: text/markdown` with its markdown representation, and advertises it with a',
    '`Link: <...>; rel="alternate"; type="text/markdown"` header.',
    '',
  ].join('\n');
}

function signIn(): string {
  return [
    ...heading('/sign-in'),
    'Continue with Google. We ask for your email address and nothing else. There is no password, and an account is only',
    'needed to claim a domain, keep a scan history, or buy anything. Running a scan and reading the result needs no',
    'account at all.',
    '',
  ].join('\n');
}

const BUILDERS: Record<string, () => string> = {
  '/': home,
  '/what-we-check': whatWeCheck,
  '/pricing': pricing,
  '/docs': docs,
  '/bot': bot,
  '/sign-in': signIn,
};

/** The markdown for a public page, or null if that path has no representation. */
export function markdownFor(path: string): string | null {
  const build = BUILDERS[path];
  return build ? build() : null;
}

/** llms.txt: what we are, and where the readable version of each page is. */
export function llmsTxt(): string {
  return [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} — we request your page as five different clients, compare what each one gets back, score the`,
    '> difference against a published catalog, and generate the files that close the gap.',
    '',
    'Every page below is also available as markdown at the same URL with `.md` appended, or by sending',
    '`Accept: text/markdown`.',
    '',
    '## Pages',
    '',
    ...PUBLIC_PAGES.filter((p) => p.listed).map(
      (p) => `- [${p.title}](${absoluteUrl(markdownPathFor(p.path))}): ${p.description}`,
    ),
    '',
    '## API',
    '',
    `- [OpenAPI description](${absoluteUrl('/openapi.json')}): the two public endpoints, POST /api/scan and GET /api/scan/{id}.`,
    `- [Agent manifest](${absoluteUrl('/.well-known/agent.json')}): what this site offers a client, in JSON.`,
    '',
    ...(PUBLIC_INDEX_LISTED
      ? ['## Optional', '', `- [Public index](${absoluteUrl('/index/saas')}): scored sites by segment.`, '']
      : []),
    '## Notes',
    '',
    `- Our own crawler is \`${USER_AGENT}\`. It obeys robots.txt and never evades a block.`,
    `- Scans are capped at ${LIMITS.maxPagesPerScan} pages, sequential, ${LIMITS.pageDelayMs}ms apart.`,
    '',
  ].join('\n');
}

/** llms-full.txt: the same pages, inlined, so one fetch is the whole site. */
export function llmsFullTxt(): string {
  const parts = [
    `# ${SITE.name} — full text`,
    '',
    'Every public page of this site, inlined, so a client needs one request rather than seven.',
    '',
    '---',
    '',
  ];
  for (const page of PUBLIC_PAGES.filter((p) => p.listed)) {
    const body = markdownFor(page.path);
    if (!body) continue;
    parts.push(body, '---', '');
  }
  return parts.join('\n');
}
