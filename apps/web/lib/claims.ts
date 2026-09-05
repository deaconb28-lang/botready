/**
 * Claiming a domain: proving control, not asserting it.
 *
 * Anyone who knows a domain name can type it. What they cannot do without
 * controlling the domain is publish a value we chose at a place we name. Two
 * places are accepted:
 *
 *   DNS   a TXT record at _botready.<domain> containing the token
 *   HTML  <meta name="botready-verify" content="<token>"> on the homepage
 *
 * The token is an HMAC over (user id, domain) with the shared secret, so it is
 * recomputed on every check rather than stored, is different for every (user,
 * domain) pair, and cannot be derived from one claim to make another.
 *
 * The DNS path makes no HTTP request at all. The HTML path does, and that is
 * a fetch of a URL a person typed, which is the SSRF shape the worker's guard
 * exists to refuse. Three things make it acceptable here:
 *   - only domains already in `sites` may be claimed, and every one of those
 *     was reached by the worker through its pinned, vetted fetcher first
 *   - the hostname is resolved and every address checked against the same
 *     private-range list the worker uses, before the request
 *   - the body is searched for one tag and nothing from it is ever returned,
 *     so a bypass would be a blind request with no readback
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { lookup, resolveTxt } from 'node:dns/promises';

import { isPrivateAddress, normaliseDomain } from '@botready/core';

import { serverEnv } from './env';

export const META_NAME = 'botready-verify';
export const TXT_HOST_PREFIX = '_botready';

export function claimToken(userId: string, domain: string, secret = serverEnv.scannerSharedSecret()): string {
  const normalised = normaliseDomain(domain);
  return `botready-verify=${createHmac('sha256', secret)
    .update(`${userId}\n${normalised}`)
    .digest('base64url')
    .slice(0, 32)}`;
}

export interface ClaimInstructions {
  domain: string;
  token: string;
  dns: {
    /** The fully qualified name: `_botready.example.com`. */
    host: string;
    /**
     * The same record as most DNS panels want it typed. Cloudflare, Namecheap
     * and Route 53 all append the zone to whatever you enter, so pasting the
     * fully qualified name into them produces `_botready.example.com.example.com`
     * and the check then fails for a reason nobody can see. Both forms are
     * shown, and the page says which is which.
     */
    hostShort: string;
    type: 'TXT';
    value: string;
  };
  meta: { tag: string };
}

export function instructions(userId: string, domain: string): ClaimInstructions {
  const normalised = normaliseDomain(domain);
  const token = claimToken(userId, normalised);
  return {
    domain: normalised,
    token,
    dns: {
      host: `${TXT_HOST_PREFIX}.${normalised}`,
      hostShort: TXT_HOST_PREFIX,
      type: 'TXT',
      value: token,
    },
    meta: { tag: `<meta name="${META_NAME}" content="${token}">` },
  };
}

export type Verification =
  | { verified: true; method: 'dns_txt' | 'meta_tag' }
  | { verified: false; reason: string };

export interface Resolvers {
  txt: (host: string) => Promise<string[][]>;
  addresses: (host: string) => Promise<string[]>;
  fetchHomepage: (url: string) => Promise<string>;
}

const defaultResolvers: Resolvers = {
  txt: (host) => resolveTxt(host),
  addresses: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
  fetchHomepage: async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'BotreadyBot/1.0 (+https://botready.dev/bot) claim-verification' },
        redirect: 'follow',
        signal: controller.signal,
      });
      // The head is where a meta tag lives; 256 KB is more than any head.
      const text = await response.text();
      return text.slice(0, 256 * 1024);
    } finally {
      clearTimeout(timer);
    }
  },
};

export async function verifyClaim(
  userId: string,
  domain: string,
  resolvers: Resolvers = defaultResolvers,
): Promise<Verification> {
  const normalised = normaliseDomain(domain);
  const expected = claimToken(userId, normalised);

  // ---------------------------------------------------------------- DNS

  try {
    const records = await resolvers.txt(`${TXT_HOST_PREFIX}.${normalised}`);
    for (const chunks of records) {
      if (constantTimeMatch(chunks.join(''), expected)) return { verified: true, method: 'dns_txt' };
    }
  } catch {
    // No record, or no zone. Fall through to the meta tag.
  }

  // ---------------------------------------------------------------- meta tag

  let addresses: string[];
  try {
    addresses = await resolvers.addresses(normalised);
  } catch {
    return { verified: false, reason: `${normalised} does not resolve, so neither proof can be read.` };
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    return {
      verified: false,
      reason: `${normalised} resolves to a private address, which we will not request.`,
    };
  }

  let html: string;
  try {
    html = await resolvers.fetchHomepage(`https://${normalised}/`);
  } catch (err) {
    return {
      verified: false,
      reason: `No TXT record at ${TXT_HOST_PREFIX}.${normalised}, and the homepage could not be read: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (metaTagPresent(html, expected)) return { verified: true, method: 'meta_tag' };

  return {
    verified: false,
    reason: `No TXT record at ${TXT_HOST_PREFIX}.${normalised} and no ${META_NAME} meta tag on the homepage. DNS can take a few minutes to propagate; try again shortly.`,
  };
}

/** Finds the tag whatever the attribute order or quoting. */
export function metaTagPresent(html: string, expected: string): boolean {
  const head = html.slice(0, 256 * 1024);
  for (const tag of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = tag[0];
    const name = /\bname\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1];
    if (name?.toLowerCase() !== META_NAME) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? /\bcontent\s*=\s*([^\s>]+)/i.exec(attrs)?.[1];
    if (content && constantTimeMatch(content.trim(), expected)) return true;
  }
  return false;
}

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
