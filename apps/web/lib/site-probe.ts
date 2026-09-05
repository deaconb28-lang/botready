import { readFraming } from './site-identity';
import { upstashKV, memoryKV, type KV } from './kv';

/**
 * One look at a scanned site, for the site card and nothing else.
 *
 * The scanner records the declared icon and the two framing headers, but only
 * on scans taken since it started doing so, and only re-scanning fills that in
 * for an existing result. Meanwhile the card has two questions it cannot fudge:
 *
 *   - Which icon? /favicon.ico is a convention, not a rule. betterpomo.com
 *     declares /Icon_light.png and answers /favicon.ico with a 404 page.
 *   - Can it be framed? A browser that refuses paints its own opaque error
 *     page inside the frame, so guessing wrong is a white rectangle that
 *     nothing drawn behind it can rescue.
 *
 * So the web app asks once per origin and caches the answer. This is a display
 * lookup, not a scan: it produces no evidence row, touches no score, and its
 * result is never a finding. It identifies itself as BotreadyBot exactly like
 * the scanner does, and a site that refuses it simply gets no card — we do not
 * retry under another name.
 */
export interface SiteProbe {
  /** The icon the page declares, absolute. Empty when it declares none. */
  icon: string;
  framing: 'allowed' | 'refused' | 'unknown';
}

const UNKNOWN: SiteProbe = { icon: '', framing: 'unknown' };

const USER_AGENT = 'BotreadyBot/1.0 (+https://botready.dev/bot)';
const TIMEOUT_MS = 4000;
/** Enough of the document to contain <head>, and a hard stop for anything else. */
const READ_LIMIT = 96 * 1024;
const CACHE_SECONDS = 6 * 60 * 60;
/** A site that would not answer is asked again sooner, but not on every view. */
const FAILURE_CACHE_SECONDS = 30 * 60;

let fallback: KV | null = null;

function cache(): KV {
  const upstash = upstashKV();
  if (upstash) return upstash;
  // No Upstash configured: still cache, per server process, so local dev and a
  // misconfigured deploy do not make one request per page view.
  fallback ??= memoryKV();
  return fallback;
}

export async function probeSite(url: string): Promise<SiteProbe> {
  const origin = safeOrigin(url);
  if (!origin) return UNKNOWN;

  const key = `sitecard:v1:${origin}`;
  const kv = cache();

  const hit = await kv.get(key).catch(() => null);
  if (hit) {
    try {
      return JSON.parse(hit) as SiteProbe;
    } catch {
      // A malformed entry is not worth a second thought; fall through and ask.
    }
  }

  const probe = await look(origin);
  await kv
    .set(key, JSON.stringify(probe), { ex: probe.framing === 'unknown' ? FAILURE_CACHE_SECONDS : CACHE_SECONDS })
    .catch(() => false);
  return probe;
}

async function look(origin: string): Promise<SiteProbe> {
  try {
    const response = await fetch(origin, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });

    if (!response.ok) return UNKNOWN;

    const framing = readFraming(
      response.headers.get('x-frame-options') ?? '',
      response.headers.get('content-security-policy') ?? '',
    );

    const html = await head(response);
    return { icon: iconFrom(html, response.url || origin), framing };
  } catch {
    // A timeout, a refusal, a certificate we do not like. All the same answer.
    return UNKNOWN;
  }
}

/** The first READ_LIMIT bytes, then hang up. We only ever want <head>. */
async function head(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length >= READ_LIMIT) break;
      // Everything we want is above this line, and most pages are mostly body.
      if (/<\/head>/i.test(text)) break;
    }
  } catch {
    // Whatever arrived is what we work with.
  } finally {
    await reader.cancel().catch(() => {});
  }
  return text;
}

/**
 * The icon the page declares, largest-first among the rels browsers honour.
 *
 * Deliberately a regex rather than a parser: this reads at most 96 KB of
 * someone else's markup for one attribute, and standing up a DOM in the web
 * app to find a href is not worth the dependency. A malformed tag we miss
 * costs a fallback to /favicon.ico, which is where we started.
 */
function iconFrom(html: string, base: string): string {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const scored = links
    .map((tag) => {
      const rel = attr(tag, 'rel').toLowerCase();
      const href = attr(tag, 'href');
      if (!href) return null;
      const type = attr(tag, 'type').toLowerCase();
      if (rel.split(/\s+/).includes('apple-touch-icon')) return { rank: 0, href };
      if (!rel.split(/\s+/).some((r) => r === 'icon' || r === 'shortcut')) return null;
      return { rank: type === 'image/svg+xml' ? 1 : 2, href };
    })
    .filter((x): x is { rank: number; href: string } => x !== null)
    .sort((a, b) => a.rank - b.rank);

  for (const { href } of scored) {
    try {
      const resolved = new URL(href, base).href;
      // Only http(s). A data: icon would be inlined into every page we render.
      if (/^https?:\/\//i.test(resolved)) return resolved;
    } catch {
      // An href we cannot resolve is one a browser cannot either.
    }
  }
  return '';
}

function attr(tag: string, name: string): string {
  const quoted = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  if (quoted) return (quoted[2] ?? quoted[3] ?? '').trim();
  const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i').exec(tag);
  return (bare?.[1] ?? '').trim();
}

/**
 * The origin to ask, or null.
 *
 * The URL comes from a scan row, which the scanner already fetched behind its
 * own pinned-connection guard, so this is not a new class of destination. What
 * this refuses is the shape that would make it one: anything but http(s), and
 * any address literal — a public site has a name, and a bare IP in a scan row
 * is the only way this could be pointed somewhere it should not go.
 */
function safeOrigin(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  // An address literal, private or not. Names only, which is what a public
  // site has — and refusing every literal is a stronger rule than sorting the
  // private ranges out of them.
  if (/^[\d.]+$/.test(host) || host.includes(':')) return null;

  return parsed.origin;
}
