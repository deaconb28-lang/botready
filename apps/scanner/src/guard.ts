/**
 * The guard. Everything the worker fetches passes through here first.
 *
 * We ship a tool that fetches arbitrary URLs on demand, which means we ship an
 * SSRF primitive unless this file is right. It is written before the scanner
 * rather than after, because a safe fetcher is easy to write and hard to
 * retrofit.
 *
 * The order matters and is the whole design:
 *
 *   1. parse, and reject anything that is not http or https
 *   2. resolve the hostname to addresses, once
 *   3. vet every address that came back, and reject if any is private
 *   4. hand the caller a single pinned address
 *   5. the fetcher connects to that address and to nothing else
 *
 * Step 5 is why this returns an address rather than a boolean. Checking a
 * hostname and then calling fetch() re-resolves the name, and a DNS entry that
 * answers publicly on the first lookup and 169.254.169.254 on the second walks
 * straight past the check. Pinning the address closes that window.
 */

import { isIP, isIPv4, type LookupFunction } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

import { isPrivateAddress } from '@botready/core';

export { isPrivateAddress };

export class BlockedTargetError extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = 'BlockedTargetError';
    this.reason = reason;
  }
}

export interface PinnedTarget {
  /** The URL as we will request it. */
  url: string;
  hostname: string;
  /** The single address the fetcher is allowed to connect to. */
  address: string;
  family: 4 | 6;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Hostnames we refuse without asking DNS. Resolution would usually catch these
 * anyway, but a resolver that is configured to do something surprising with
 * `localhost` should not be the only thing standing between us and the loopback
 * interface.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

/** Suffixes that only ever name something inside a network. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

/**
 * The one hole in the wall, and it is welded shut in production.
 *
 * The scan tests stand up a real HTTP server on the loopback interface and run
 * a real scan against it, which is the only way to test that a robots.txt
 * disallowing us actually stops the crawl. That server is at 127.0.0.1, which
 * this file exists to refuse.
 *
 * So: SCANNER_ALLOW_PRIVATE_HOSTS is a comma-separated list of host:port pairs
 * that skip the address check, and it is read fresh on every call and ignored
 * outright when NODE_ENV is production. A test asserts that second half,
 * because an allowlist that quietly works in production is worse than no test
 * coverage at all.
 */
function developmentAllowlist(): Set<string> {
  if (process.env.NODE_ENV === 'production') return new Set();
  const raw = process.env.SCANNER_ALLOW_PRIVATE_HOSTS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function allowedForDevelopment(url: URL): boolean {
  const allowlist = developmentAllowlist();
  if (allowlist.size === 0) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  return allowlist.has(`${host}:${port}`) || allowlist.has(host);
}

// ------------------------------------------------------------------ addresses

// ------------------------------------------------------------------ the guard

/**
 * Vet a URL and pin the address the fetcher may use. Throws BlockedTargetError
 * with a reason the interface can print, because "we will not fetch that" needs
 * to say why.
 */
export async function pinTarget(
  input: string,
  opts: { resolve?: Resolver } = {},
): Promise<PinnedTarget> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedTargetError(`${input} is not a URL we can parse.`, 'unparseable');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedTargetError(
      `We request over http and https. ${url.protocol.replace(':', '')} is not a scheme we will open.`,
      'scheme',
    );
  }

  if (url.username || url.password) {
    throw new BlockedTargetError(
      'The URL carries credentials. We do not scan anything behind auth.',
      'credentials',
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (!hostname) {
    throw new BlockedTargetError(`${input} has no host.`, 'no-host');
  }
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BlockedTargetError(
      `${hostname} names this machine or its metadata service, not a public site.`,
      'blocked-hostname',
    );
  }
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new BlockedTargetError(
      `${hostname} is a private network name, not a public site.`,
      'blocked-suffix',
    );
  }

  if (allowedForDevelopment(url)) {
    const literal = isIP(hostname);
    return {
      url: url.toString(),
      hostname,
      address: literal ? hostname : '127.0.0.1',
      family: literal && !isIPv4(hostname) ? 6 : 4,
    };
  }

  // A literal address needs no lookup, and must not get one: resolving it would
  // be a no-op and would only add a place for the answer to change.
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new BlockedTargetError(
        `${hostname} is a private or reserved address. We only fetch public hosts.`,
        'private-address',
      );
    }
    return {
      url: url.toString(),
      hostname,
      address: hostname,
      family: isIPv4(hostname) ? 4 : 6,
    };
  }

  if (!hostname.includes('.')) {
    throw new BlockedTargetError(
      `${hostname} has no dot in it, so it is not a public hostname.`,
      'not-fqdn',
    );
  }

  const resolve = opts.resolve ?? defaultResolver;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolve(hostname);
  } catch (err) {
    throw new BlockedTargetError(
      `${hostname} does not resolve. ${err instanceof Error ? err.message : String(err)}`,
      'dns',
    );
  }

  if (addresses.length === 0) {
    throw new BlockedTargetError(`${hostname} resolves to nothing.`, 'dns-empty');
  }

  // Every answer has to be public, not just the one we would have picked. A
  // name that resolves to both a public address and 127.0.0.1 is a name we
  // refuse, because which one we connect to is not ours to decide.
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedTargetError(
        `${hostname} resolves to ${address}, which is a private or reserved address. We only fetch public hosts.`,
        'resolves-private',
      );
    }
  }

  const chosen = addresses[0];
  if (!chosen) {
    throw new BlockedTargetError(`${hostname} resolves to nothing.`, 'dns-empty');
  }

  return {
    url: url.toString(),
    hostname,
    address: chosen.address,
    family: chosen.family === 6 ? 6 : 4,
  };
}

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: Resolver = async (hostname) => {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true });
  return answers.map((a) => ({ address: a.address, family: a.family }));
};

/**
 * The pinned lookup handed to node:https. It ignores the hostname it is given
 * and returns the address the guard already vetted, which is what makes the
 * check and the connection the same decision rather than two decisions with a
 * gap between them.
 */
export function pinnedLookup(target: PinnedTarget): LookupFunction {
  return (_hostname, options, callback) => {
    // Node 20+ connects with autoSelectFamily on by default, and in that mode
    // the socket asks the lookup for every address (`all: true`) and expects an
    // array back. Answering with a bare string there makes Node read
    // `addresses[0].address` off a string and fail with "Invalid IP address:
    // undefined", which is what a scan on Railway did. Honour both shapes.
    if (typeof options === 'object' && options !== null && options.all) {
      (callback as unknown as (err: null, addresses: Array<{ address: string; family: number }>) => void)(
        null,
        [{ address: target.address, family: target.family }],
      );
      return;
    }
    callback(null, target.address, target.family);
  };
}
