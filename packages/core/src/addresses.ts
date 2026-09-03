/**
 * Private and reserved address ranges. Pure, so the worker's SSRF guard and the
 * web app's claim verification refuse the same addresses from the same list.
 * The guard in apps/scanner/src/guard.ts is the thing that actually pins a
 * connection; this is only the judgement about an address it has already got.
 */

/**
 * An address a public site could never legitimately be on. The four ranges the
 * build plan calls out are here, plus the ones that matter in practice: the
 * cloud metadata endpoint sits in 169.254/16, carrier NAT in 100.64/10 hides
 * whole internal networks, and 0.0.0.0/8 is the classic way to say "this host"
 * without typing 127.
 */
export function isPrivateAddress(address: string): boolean {
  if (isV4(address)) return isPrivateV4(address);
  if (address.includes(':')) return isPrivateV6(address);
  // Not an address at all. Refusing is the safe direction.
  return true;
}

/** Dotted quad, each octet 0 to 255. Written out so core stays free of Node built-ins. */
export function isV4(address: string): boolean {
  const parts = address.split('.');
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
}

function isPrivateV4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a = 0, b = 0, c = 0, d = 0] = parts;

  if (a === 0) return true; // 0.0.0.0/8, "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 carrier NAT
  if (a === 169 && b === 254) return true; // 169.254/16 link-local, the metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2/24 documentation
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100/24 documentation
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113/24 documentation
  if (a >= 224) return true; // 224/4 multicast, 240/4 reserved, 255.255.255.255
  void d;
  return false;
}

function isPrivateV6(input: string): boolean {
  const address = input.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';

  // An IPv4-mapped or IPv4-compatible address is an IPv4 address wearing a hat.
  // Judge it as one, or 127.0.0.1 gets through as ::ffff:127.0.0.1.
  const mapped = /^(?:::ffff:|::)((?:\d{1,3}\.){3}\d{1,3})$/.exec(address);
  if (mapped?.[1]) return isPrivateV4(mapped[1]);

  if (address === '::' || address === '::1') return true; // unspecified, loopback
  if (address.startsWith('fc') || address.startsWith('fd')) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(address)) return true; // fe80::/10 link-local
  if (address.startsWith('ff')) return true; // ff00::/8 multicast
  if (address.startsWith('2001:db8')) return true; // documentation
  if (address.startsWith('64:ff9b:')) return true; // NAT64, which maps to v4 we cannot see
  return false;
}
