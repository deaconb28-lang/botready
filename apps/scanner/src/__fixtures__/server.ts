/**
 * Four sites on the loopback interface, served by one switchable server.
 *
 * The scan tests run the real scanner against these: real robots.txt, real
 * sitemap, real Chromium render. Mocking the fetcher would test the mock, and
 * the two findings this product exists for — a 403 to one user agent and a page
 * that only exists after JavaScript — are precisely the things a mock cannot
 * reproduce honestly.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type FixtureMode =
  /** Server-rendered, well described, everything an agent could want. */
  | 'good'
  /** robots.txt disallows BotreadyBot by name. */
  | 'robots-blocked'
  /** 200 to Chrome, 403 to every bot user agent, the way a WAF behaves. */
  | 'waf-blocked'
  /** An empty shell that a script fills in. */
  | 'spa';

export interface Fixture {
  origin: string;
  port: number;
  mode: FixtureMode;
  setMode(mode: FixtureMode): void;
  /** Every request the fixture received, for asserting on crawl behaviour. */
  requests: Array<{ method: string; path: string; userAgent: string }>;
  close(): Promise<void>;
}

export async function startFixture(mode: FixtureMode = 'good'): Promise<Fixture> {
  let current = mode;
  const requests: Fixture['requests'] = [];

  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const userAgent = String(req.headers['user-agent'] ?? '');
    requests.push({ method: req.method ?? 'GET', path, userAgent });
    route(current, path, req, res, port());
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  function port(): number {
    return (server.address() as AddressInfo).port;
  }

  return {
    get origin() {
      return `http://127.0.0.1:${port()}`;
    },
    get port() {
      return port();
    },
    get mode() {
      return current;
    },
    setMode(next) {
      current = next;
      requests.length = 0;
    },
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ------------------------------------------------------------------ routing

const BOT_AGENTS = /claudebot|gptbot|perplexitybot|google-extended|botreadybot/i;

function route(
  mode: FixtureMode,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
): void {
  const userAgent = String(req.headers['user-agent'] ?? '');
  const origin = `http://127.0.0.1:${port}`;

  // The WAF fixture answers Chrome and refuses everything else, from the same
  // address, in the same second. This is the product's headline finding.
  if (mode === 'waf-blocked' && BOT_AGENTS.test(userAgent) && path !== '/robots.txt') {
    res.writeHead(403, { 'content-type': 'text/html', server: 'cloudflare', 'cf-mitigated': 'challenge' });
    res.end('<html><body>Sorry, you have been blocked</body></html>');
    return;
  }

  switch (path) {
    case '/robots.txt':
      return text(res, robotsTxt(mode, origin));

    case '/sitemap.xml':
      if (mode === 'spa') return notFound(res);
      return xml(res, sitemapXml(origin));

    case '/llms.txt':
      if (mode !== 'good') return notFound(res);
      return text(res, llmsTxt(origin));

    case '/llms-full.txt':
      if (mode !== 'good') return notFound(res);
      return text(res, '# everything, at length\n');

    case '/.well-known/agent.json':
      if (mode !== 'good') return notFound(res);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ name: 'Example', version: '1.0' }));
      return;

    case '/':
      return home(mode, req, res, origin);

    case '/pricing':
      return pricing(mode, res, origin);

    case '/docs':
      return html(res, page('Docs — Example', 'How to use the API.', origin, '/docs'));

    case '/api':
      return html(res, page('API reference — Example', 'Every endpoint.', origin, '/api'));

    case '/about':
      return html(res, page('About Example', 'Who we are.', origin, '/about'));

    case '/blog':
      return html(res, page('Blog — Example', 'What we shipped.', origin, '/blog'));

    default:
      return notFound(res);
  }
}

function robotsTxt(mode: FixtureMode, origin: string): string {
  if (mode === 'robots-blocked') {
    return [
      'User-agent: BotreadyBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
  }
  if (mode === 'waf-blocked') {
    // Nothing in robots.txt asks for the 403. That is the point of this fixture:
    // the refusal is a bot-protection rule rather than a decision.
    return ['User-agent: *', 'Allow: /', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  }
  if (mode === 'spa') {
    return ['User-agent: *', 'Allow: /', ''].join('\n');
  }
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function sitemapXml(origin: string): string {
  const entries = [
    ['/', '2026-08-30'],
    ['/pricing', '2026-08-12'],
    ['/docs', '2026-07-28'],
    ['/api', '2026-06-04'],
    ['/about', '2026-02-19'],
  ] as const;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ([path, lastmod]) =>
        `  <url><loc>${origin}${path}</loc><lastmod>${lastmod}</lastmod></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');
}

function llmsTxt(origin: string): string {
  return [
    '# Example',
    '> A worked example of a site an agent can read.',
    '',
    '## Product',
    `- [Pricing](${origin}/pricing): what it costs`,
    `- [Docs](${origin}/docs): how to use it`,
    '',
  ].join('\n');
}

// ------------------------------------------------------------------ pages

function home(mode: FixtureMode, req: IncomingMessage, res: ServerResponse, origin: string): void {
  const accept = String(req.headers['accept'] ?? '');

  // The good fixture honours Accept: text/markdown, so the content-negotiation
  // check has something to pass against.
  if (mode === 'good' && /text\/(x-)?markdown/.test(accept)) {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end('# Example\n\nThe same page, as markdown.\n');
    return;
  }

  if (mode === 'spa') return html(res, spaShell(origin), { cache: false });
  return html(res, goodHome(origin), { cache: true });
}

function pricing(mode: FixtureMode, res: ServerResponse, origin: string): void {
  if (mode === 'spa') return html(res, spaShell(origin), { cache: false });
  const body = `
    <main>
      <h1>Pricing</h1>
      <h2>Plans</h2>
      <p>The Team plan is $99 per month. The Free plan is $0.</p>
      <form action="/signup">
        <label for="email">Work email</label>
        <input id="email" name="email" type="email" autocomplete="email">
        <label for="company">Company</label>
        <input id="company" name="company" type="text" autocomplete="organization">
        <button type="submit">Start</button>
      </form>
    </main>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Example Team',
    offers: {
      '@type': 'Offer',
      price: '99.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
  return html(
    res,
    shell({
      title: 'Pricing — Example',
      description: 'What Example costs, per seat and per month.',
      canonical: `${origin}/pricing`,
      origin,
      body,
      jsonLd,
    }),
    { cache: true },
  );
}

function page(title: string, description: string, origin: string, path: string): string {
  return shell({
    title,
    description,
    canonical: `${origin}${path}`,
    origin,
    body: `<main><h1>${title}</h1><h2>Detail</h2><p>${description}</p><p><a href="/api">API reference</a></p></main>`,
  });
}

function goodHome(origin: string): string {
  const body = `
    <main>
      <h1>Example</h1>
      <h2>What it does</h2>
      <p>Example is a worked example of a site that an agent can read without
         running any JavaScript. Every sentence on this page is in the HTML that
         the server sent, which is the entire point of the fixture. The text
         continues for long enough that a readability pass finds an article
         here rather than deciding the page is a navigation shell, because a
         short paragraph is not enough for the extractor to commit to.</p>
      <h2>Who it is for</h2>
      <p>Teams that would rather their documentation be legible to a machine
         than not. There is a pricing page, there is an API reference, and both
         of them are linked from here in plain anchors that need no script to
         resolve. That is all this fixture is claiming to demonstrate.</p>
      <h3>Where to go next</h3>
      <ul>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/docs">Docs</a></li>
        <li><a href="/api">API reference</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/blog">Blog</a></li>
      </ul>
    </main>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Example',
    url: origin,
  };
  return shell({
    title: 'Example — a site an agent can read',
    description: 'A worked example of a server-rendered, well described site.',
    canonical: `${origin}/`,
    origin,
    body,
    jsonLd,
    markdownAlternate: true,
  });
}

/**
 * The SPA fixture. The raw response carries a title and nothing else, and the
 * body is written by script, which is exactly the shape that makes a site
 * invisible to a client that does not run a browser.
 */
function spaShell(origin: string): string {
  const prose = [
    'This paragraph only exists because a script ran.',
    'A client that does not execute JavaScript sees an empty div where this text should be, and there is a lot of this text, because the ratio is measured in characters and a single sentence would not separate a rendering problem from rounding.',
    'The pricing table is here too, at ninety-nine dollars a month, and it is equally invisible to a plain fetch.',
    'Everything an agent would want to summarise about this page is on the far side of a bundle it will never run.',
  ].join(' ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Example SPA</title>
  <link rel="canonical" href="${origin}/">
</head>
<body>
  <div id="root"></div>
  <script>
    var root = document.getElementById('root');
    var main = document.createElement('main');
    var h1 = document.createElement('h1');
    h1.textContent = 'Example SPA';
    var p = document.createElement('p');
    p.textContent = ${JSON.stringify(prose)};
    var p2 = document.createElement('p');
    p2.textContent = ${JSON.stringify(prose)};
    main.appendChild(h1);
    main.appendChild(p);
    main.appendChild(p2);
    root.appendChild(main);
  </script>
</body>
</html>`;
}

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  origin: string;
  body: string;
  jsonLd?: unknown;
  markdownAlternate?: boolean;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${opts.title}</title>
  <meta name="description" content="${opts.description}">
  <link rel="canonical" href="${opts.canonical}">
  ${opts.markdownAlternate ? `<link rel="alternate" type="text/markdown" href="${opts.canonical}index.md">` : ''}
  <meta property="og:title" content="${opts.title}">
  <meta property="og:description" content="${opts.description}">
  <meta property="og:image" content="${opts.origin}/og.png">
  <meta property="og:url" content="${opts.canonical}">
  <meta property="og:type" content="website">
  ${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>` : ''}
</head>
<body>
  <nav><a href="/">Home</a> <a href="/pricing">Pricing</a> <a href="/docs">Docs</a></nav>
  ${opts.body}
  <footer><p>Example</p></footer>
</body>
</html>`;
}

// ------------------------------------------------------------------ responses

function html(res: ServerResponse, body: string, opts: { cache?: boolean } = {}): void {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
  if (opts.cache) {
    headers['last-modified'] = new Date('2026-08-30T09:00:00Z').toUTCString();
    headers['etag'] = '"a1b2c3"';
  }
  res.writeHead(200, headers);
  res.end(body);
}

function text(res: ServerResponse, body: string): void {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function xml(res: ServerResponse, body: string): void {
  res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
  res.end(body);
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found\n');
}
