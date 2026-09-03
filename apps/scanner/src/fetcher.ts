/**
 * The only way this worker makes an outbound request.
 *
 * Hand-rolled on node:https rather than global fetch, for three reasons that
 * all matter to the product:
 *
 *   1. The connection has to go to an address the guard already vetted, not to
 *      whatever the resolver says at connect time. fetch() gives no way to pin
 *      one, so DNS rebinding would stay open. `lookup` on node:https does.
 *   2. Redirects are evidence. Chain depth is a scored check, and every hop has
 *      to be re-vetted anyway, because an open redirect to 169.254.169.254 is
 *      the same SSRF with an extra step. Manual redirects give us both.
 *   3. Time to first byte is a scored check, and fetch() resolves its promise
 *      after the headers, which is close but not the same measurement.
 */

import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';

import { BlockedTargetError, pinTarget, pinnedLookup, type PinnedTarget } from './guard';
import { FETCH_TIMEOUT_MS, MAX_BODY_BYTES, USER_AGENT } from './version';

export interface FetchOptions {
  userAgent?: string;
  /** Extra request headers. Used by the content-negotiation probe. */
  headers?: Record<string, string>;
  /** Hard cap on hops. Anything past this is recorded, not followed. */
  maxRedirects?: number;
  timeoutMs?: number;
  /** HEAD is enough for a liveness probe on a sitemap URL. */
  method?: 'GET' | 'HEAD';
}

export interface RedirectHop {
  from: string;
  to: string;
  status: number;
}

export interface FetchOutcome {
  /** The URL finally requested, after redirects. */
  url: string;
  /** The URL originally asked for. */
  requestedUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  /** Milliseconds to the first byte of the final response. */
  ttfbMs: number;
  /** Milliseconds from the first request to the last byte. */
  totalMs: number;
  redirects: RedirectHop[];
  /** True when the body was cut off at MAX_BODY_BYTES. */
  truncated: boolean;
  /**
   * Set when no response was produced at all: DNS failure, TLS failure, reset,
   * timeout, or a guard refusal on a redirect target. A transport error is an
   * observation like any other, not an exception the caller has to catch.
   */
  transportError?: string;
}

/**
 * One request, following redirects, re-vetting every hop.
 *
 * Never throws for a network condition. It throws only when the *original* URL
 * is one we refuse to open, which is a caller mistake rather than a fact about
 * the site.
 */
export async function guardedFetch(
  targetUrl: string,
  options: FetchOptions = {},
): Promise<FetchOutcome> {
  const maxRedirects = options.maxRedirects ?? 8;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const startedAt = performance.now();

  // The first hop is vetted here and allowed to throw: asking for
  // http://localhost is a bad request, not a bad site.
  let pinned = await pinTarget(targetUrl);

  const redirects: RedirectHop[] = [];
  let currentUrl = pinned.url;

  for (let hop = 0; ; hop += 1) {
    let response: RawResponse;
    try {
      response = await once(currentUrl, pinned, {
        ...options,
        timeoutMs: Math.max(1000, timeoutMs - (performance.now() - startedAt)),
      });
    } catch (err) {
      return {
        url: currentUrl,
        requestedUrl: targetUrl,
        status: 0,
        headers: {},
        body: '',
        bytes: 0,
        ttfbMs: Math.round(performance.now() - startedAt),
        totalMs: Math.round(performance.now() - startedAt),
        redirects,
        truncated: false,
        transportError: err instanceof Error ? err.message : String(err),
      };
    }

    const location = response.headers['location'];
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect || hop >= maxRedirects) {
      return {
        url: currentUrl,
        requestedUrl: targetUrl,
        status: response.status,
        headers: response.headers,
        body: response.body,
        bytes: response.bytes,
        ttfbMs: Math.round(response.ttfbMs),
        totalMs: Math.round(performance.now() - startedAt),
        redirects,
        truncated: response.truncated,
        ...(isRedirect
          ? { transportError: `Stopped after ${maxRedirects} redirects without a final response.` }
          : {}),
      };
    }

    let next: string;
    try {
      next = new URL(location, currentUrl).toString();
    } catch {
      return {
        url: currentUrl,
        requestedUrl: targetUrl,
        status: response.status,
        headers: response.headers,
        body: '',
        bytes: response.bytes,
        ttfbMs: Math.round(response.ttfbMs),
        totalMs: Math.round(performance.now() - startedAt),
        redirects,
        truncated: false,
        transportError: `The Location header is not a URL: ${location}`,
      };
    }

    redirects.push({ from: currentUrl, to: next, status: response.status });

    // Re-vet. A site is free to redirect us anywhere, including somewhere we
    // will not go, and this is where an open redirect stops being our problem.
    try {
      pinned = await pinTarget(next);
    } catch (err) {
      return {
        url: currentUrl,
        requestedUrl: targetUrl,
        status: response.status,
        headers: response.headers,
        body: '',
        bytes: response.bytes,
        ttfbMs: Math.round(response.ttfbMs),
        totalMs: Math.round(performance.now() - startedAt),
        redirects,
        truncated: false,
        transportError:
          err instanceof BlockedTargetError
            ? `Redirected to ${next}, which we will not open: ${err.message}`
            : String(err),
      };
    }
    currentUrl = pinned.url;
  }
}

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  ttfbMs: number;
  truncated: boolean;
}

function once(
  url: string,
  pinned: PinnedTarget,
  options: FetchOptions & { timeoutMs: number },
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const parsed = new URL(url);
    const secure = parsed.protocol === 'https:';
    const send = secure ? httpsRequest : httpRequest;
    const startedAt = performance.now();

    const req = send(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (secure ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method ?? 'GET',
        // The connection goes here and nowhere else.
        lookup: pinnedLookup(pinned),
        // Host and SNI still carry the real name, so virtual hosting and
        // certificate validation both behave normally.
        servername: secure ? parsed.hostname : undefined,
        headers: {
          host: parsed.host,
          'user-agent': options.userAgent ?? USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'identity', // byte counts should be of the real body
          ...(options.headers ?? {}),
        },
        timeout: options.timeoutMs,
      },
      (res: IncomingMessage) => {
        const ttfbMs = performance.now() - startedAt;
        const chunks: Buffer[] = [];
        let bytes = 0;
        let truncated = false;

        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({
            status: res.statusCode ?? 0,
            headers: flatten(res.headers),
            body: Buffer.concat(chunks).toString('utf8'),
            bytes,
            ttfbMs,
            truncated,
          });
        };

        res.on('end', finish);
        // A destroy from the byte cap lands here rather than on 'end'.
        res.on('close', finish);
        res.on('error', (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`No response within ${Math.round(options.timeoutMs)} ms.`));
    });
    req.on('error', reject);
    req.end();
  });
}

function flatten(headers: IncomingMessage['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

/**
 * Sequential, and this far apart. Not a helper for politeness: the one second
 * gap and the six page cap are product constraints, so the only thing in the
 * worker that walks a list of URLs is this function.
 */
export async function crawlSequentially<T>(
  urls: string[],
  gapMs: number,
  visit: (url: string, index: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (const [index, url] of urls.entries()) {
    if (index > 0) await delay(gapMs);
    out.push(await visit(url, index));
  }
  return out;
}
