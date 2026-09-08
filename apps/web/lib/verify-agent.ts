import { promises as dns } from 'node:dns';

import { identify, knownAgent, type Evidence, type Identity } from '@botready/core';

import { defaultKV } from './kv';

/**
 * The lookups identify() judges, done once per IP and cached.
 *
 * Forward-confirmed reverse DNS is two lookups, not one. Reverse the IP to a
 * hostname, check the hostname is under the vendor's suffix, then resolve that
 * hostname and confirm it comes back to the IP we started with. The forward
 * half is the whole defence: a PTR record is set by whoever controls the
 * address block, so anyone renting a machine can point one at
 * crawl-1.perplexity.ai. Only the forward lookup catches that, and it is the
 * step most implementations skip.
 *
 * Cached per IP, because a crawler comes from a small set of addresses and a
 * batch of ten thousand hits is usually a few dozen of them. A verdict is good
 * for a week; the addresses move slowly and a stale yes is a smaller error
 * than a DNS query per log line.
 *
 * Every failure degrades to unverified rather than to a verdict. A resolver
 * timing out is not evidence that a crawler is a fake, and constraint 7 cuts
 * both ways — a claim with no proof is not verified, and a claim we could not
 * check is not disproved.
 */

const CACHE_SECONDS = 7 * 24 * 3600;
const LOOKUP_TIMEOUT_MS = 2_000;

export async function verifyAgent(userAgent: string, ip: string | null): Promise<Identity> {
  const claimed = identify(userAgent);
  // Not an agent we know, or no address to check. Either way there is nothing
  // to look up and the honest answer is the one identify() already gave.
  if (!claimed.agentId || !ip) return claimed;

  const cached = await readCache(claimed.agentId, ip);
  if (cached) return identify(userAgent, cached);

  const evidence = await gather(claimed.agentId, ip);
  await writeCache(claimed.agentId, ip, evidence);
  return identify(userAgent, evidence);
}

async function gather(agentId: string, ip: string): Promise<Evidence> {
  const agent = knownAgent(agentId);
  if (!agent) return {};

  const evidence: Evidence = {};

  if (agent.rdnsSuffixes.length > 0) {
    const host = await reverse(ip);
    evidence.rdnsHost = host;
    if (host) {
      const matches = agent.rdnsSuffixes.some((s) => host.toLowerCase().endsWith(s.toLowerCase()));
      // Only forward-confirm a hostname that claims to be theirs. Resolving
      // somebody's unrelated PTR tells us nothing and costs a lookup.
      if (matches) evidence.forwardConfirmed = await resolvesTo(host, ip);
    }
  }

  if (agent.rangeUrls.length > 0 && evidence.forwardConfirmed !== true) {
    const inRange = await inPublishedRange(agent.rangeUrls, ip);
    // Left undefined when the list could not be fetched, which identify()
    // reads as "not checked" rather than as "not in it".
    if (inRange !== null) evidence.inPublishedRange = inRange;
  }

  return evidence;
}

async function reverse(ip: string): Promise<string | null> {
  try {
    const names = await withTimeout(dns.reverse(ip));
    return names[0] ?? null;
  } catch {
    return null;
  }
}

async function resolvesTo(host: string, ip: string): Promise<boolean> {
  try {
    const [v4, v6] = await Promise.all([
      withTimeout(dns.resolve4(host)).catch(() => [] as string[]),
      withTimeout(dns.resolve6(host)).catch(() => [] as string[]),
    ]);
    return [...v4, ...v6].includes(ip);
  } catch {
    // A hostname that will not resolve at all is not a confirmation, and it is
    // not a disproof either — identify() only treats an explicit false as one,
    // so this returns false and the caller has already established the suffix
    // matched. That combination is the forgery case, deliberately.
    return false;
  }
}

/**
 * Whether the address is inside any range the vendor publishes.
 *
 * Null when no list could be read, which is the difference between "not
 * theirs" and "we do not know". Lists are cached for a day: a vendor adding a
 * range should show up quickly, and fetching four JSON files per log batch
 * should not happen at all.
 */
async function inPublishedRange(urls: string[], ip: string): Promise<boolean | null> {
  let checkedAny = false;
  for (const url of urls) {
    const cidrs = await publishedCidrs(url);
    if (cidrs === null) continue;
    checkedAny = true;
    if (cidrs.some((cidr) => ipInCidr(ip, cidr))) return true;
  }
  return checkedAny ? false : null;
}

async function publishedCidrs(url: string): Promise<string[] | null> {
  const key = `ranges:${url}`;
  const cached = await readJson<string[]>(key);
  if (cached) return cached;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { prefixes?: Array<Record<string, string>> };
    const cidrs = (body.prefixes ?? [])
      .map((p) => p.ipv4Prefix ?? p.ipv6Prefix ?? p.ipv4 ?? p.ipv6 ?? '')
      .filter(Boolean);
    if (cidrs.length === 0) return null;
    await writeJson(key, cidrs, 24 * 3600);
    return cidrs;
  } catch {
    return null;
  }
}

/**
 * IPv4 and IPv6 CIDR containment, by hand.
 *
 * A dependency for this is a supply-chain risk taken on behalf of a function
 * that is thirty lines and has an exact answer. Both families are compared as
 * big integers so a /33 or a /129 is not a special case.
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split('/');
  if (!network) return false;
  const bits = Number(bitsRaw);
  const a = toBigInt(ip);
  const b = toBigInt(network);
  if (a === null || b === null) return false;

  const width = ip.includes(':') ? 128 : 32;
  if (network.includes(':') !== ip.includes(':')) return false;
  const prefix = Number.isFinite(bits) ? bits : width;
  if (prefix < 0 || prefix > width) return false;

  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(width - prefix);
  return (a & mask) === (b & mask);
}

function toBigInt(ip: string): bigint | null {
  if (!ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let out = 0n;
    for (const part of parts) {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 0 || n > 255) return null;
      out = (out << 8n) | BigInt(n);
    }
    return out;
  }

  // IPv6, including the :: run and a trailing dotted-quad.
  const [head, tail] = ip.split('::');
  const expand = (s: string) => (s ? s.split(':').filter(Boolean) : []);
  let groups = [...expand(head ?? '')];
  const tailGroups = tail === undefined ? [] : expand(tail);
  if (tail !== undefined) {
    const missing = 8 - groups.length - tailGroups.length;
    if (missing < 0) return null;
    groups = [...groups, ...Array(missing).fill('0'), ...tailGroups];
  }
  if (groups.length !== 8) return null;

  let out = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    out = (out << 16n) | BigInt(parseInt(group, 16));
  }
  return out;
}

const readCache = (agentId: string, ip: string) => readJson<Evidence>(cacheKey(agentId, ip));

const writeCache = (agentId: string, ip: string, evidence: Evidence) =>
  writeJson(cacheKey(agentId, ip), evidence, CACHE_SECONDS);

/**
 * The KV stores strings and may not be configured at all. Both are handled the
 * same way: no cache means the lookups happen, which is slower and just as
 * correct. Nothing here may throw into a log batch.
 */
async function readJson<T>(key: string): Promise<T | null> {
  const kv = defaultKV();
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown, seconds: number): Promise<void> {
  const kv = defaultKV();
  if (!kv) return;
  try {
    await kv.set(key, JSON.stringify(value), { ex: seconds });
  } catch {
    /* the cache is an optimisation; the verdict is already computed */
  }
}

function cacheKey(agentId: string, ip: string): string {
  return `agentproof:${agentId}:${ip}`;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), LOOKUP_TIMEOUT_MS)),
  ]);
}
