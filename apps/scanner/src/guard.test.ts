import { afterEach, describe, expect, it } from 'vitest';

import { BlockedTargetError, isPrivateAddress, pinTarget, type Resolver } from './guard';

/** A resolver that answers with whatever the test says, without touching DNS. */
function resolvesTo(...addresses: Array<[string, number]>): Resolver {
  return async () => addresses.map(([address, family]) => ({ address, family }));
}

const publicResolver = resolvesTo(['93.184.216.34', 4]);

describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.1.2.3', 'the rest of 127/8'],
    ['10.0.0.1', '10/8'],
    ['172.16.0.1', 'the bottom of 172.16/12'],
    ['172.31.255.255', 'the top of 172.16/12'],
    ['192.168.1.1', '192.168/16'],
    ['169.254.169.254', 'the cloud metadata endpoint'],
    ['0.0.0.0', 'this host'],
    ['100.64.0.1', 'carrier NAT'],
    ['255.255.255.255', 'broadcast'],
    ['224.0.0.1', 'multicast'],
    ['::1', 'IPv6 loopback'],
    ['fd00::1', 'IPv6 unique-local'],
    ['fc00::1', 'the other half of fc00::/7'],
    ['fe80::1', 'IPv6 link-local'],
    ['::ffff:127.0.0.1', 'an IPv4-mapped loopback address'],
    ['::ffff:169.254.169.254', 'an IPv4-mapped metadata address'],
    ['not-an-address', 'a string that is not an address at all'],
  ])('refuses %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    ['93.184.216.34', 'a public IPv4 address'],
    ['1.1.1.1', 'a public resolver'],
    ['172.15.0.1', 'just below 172.16/12'],
    ['172.32.0.1', 'just above 172.16/12'],
    ['2606:2800:220:1:248:1893:25c8:1946', 'a public IPv6 address'],
  ])('allows %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('pinTarget', () => {
  it('refuses http://localhost by name, before it ever asks DNS', async () => {
    await expect(pinTarget('http://localhost/')).rejects.toMatchObject({
      name: 'BlockedTargetError',
      reason: 'blocked-hostname',
    });
  });

  it('refuses the cloud metadata endpoint, which is the one that actually matters', async () => {
    await expect(pinTarget('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });

  it('refuses a hostname that resolves to 127.0.0.1', async () => {
    // The case a hostname allowlist would miss: the name looks public and only
    // the answer gives it away.
    await expect(
      pinTarget('https://rebind.example.com/', { resolve: resolvesTo(['127.0.0.1', 4]) }),
    ).rejects.toMatchObject({ reason: 'resolves-private' });
  });

  it('refuses a hostname where only one of several answers is private', async () => {
    await expect(
      pinTarget('https://mixed.example.com/', {
        resolve: resolvesTo(['93.184.216.34', 4], ['10.1.2.3', 4]),
      }),
    ).rejects.toMatchObject({ reason: 'resolves-private' });
  });

  it('pins a valid public URL to the address it resolved, not to the hostname', async () => {
    const pinned = await pinTarget('https://example.com/pricing', { resolve: publicResolver });
    expect(pinned).toEqual({
      url: 'https://example.com/pricing',
      hostname: 'example.com',
      address: '93.184.216.34',
      family: 4,
    });
  });

  it.each([
    ['file:///etc/passwd', 'scheme'],
    ['gopher://example.com/', 'scheme'],
    ['ftp://example.com/', 'scheme'],
  ])('refuses %s', async (url, reason) => {
    await expect(pinTarget(url)).rejects.toMatchObject({ reason });
  });

  it('refuses a URL carrying credentials rather than scanning behind auth', async () => {
    await expect(
      pinTarget('https://user:pass@example.com/', { resolve: publicResolver }),
    ).rejects.toMatchObject({ reason: 'credentials' });
  });

  it.each(['http://intranet.local/', 'http://wiki.internal/', 'http://box.home.arpa/'])(
    'refuses the private network name %s',
    async (url) => {
      await expect(pinTarget(url)).rejects.toMatchObject({ reason: 'blocked-suffix' });
    },
  );

  it('refuses a single-label host, which cannot be a public site', async () => {
    await expect(pinTarget('http://intranet/')).rejects.toMatchObject({ reason: 'not-fqdn' });
  });

  it('reports a resolution failure as a refusal rather than crashing', async () => {
    const failing: Resolver = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    await expect(pinTarget('https://nope.example.com/', { resolve: failing })).rejects.toBeInstanceOf(
      BlockedTargetError,
    );
  });

  it('strips a trailing root-label dot before deciding', async () => {
    const pinned = await pinTarget('https://example.com./', { resolve: publicResolver });
    expect(pinned.hostname).toBe('example.com');
  });
});

describe('the development allowlist', () => {
  afterEach(() => {
    delete process.env.SCANNER_ALLOW_PRIVATE_HOSTS;
    process.env.NODE_ENV = 'test';
  });

  it('lets the scan tests reach their own loopback server', async () => {
    process.env.SCANNER_ALLOW_PRIVATE_HOSTS = '127.0.0.1:8123';
    const pinned = await pinTarget('http://127.0.0.1:8123/');
    expect(pinned.address).toBe('127.0.0.1');
  });

  it('is inert in production, whatever the variable says', async () => {
    // The whole reason the hole is acceptable is that it is welded shut here.
    process.env.SCANNER_ALLOW_PRIVATE_HOSTS = '127.0.0.1:8123';
    process.env.NODE_ENV = 'production';
    await expect(pinTarget('http://127.0.0.1:8123/')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });

  it('does not open a host the allowlist does not name', async () => {
    process.env.SCANNER_ALLOW_PRIVATE_HOSTS = '127.0.0.1:8123';
    await expect(pinTarget('http://10.0.0.5:8123/')).rejects.toMatchObject({
      reason: 'private-address',
    });
  });
});
