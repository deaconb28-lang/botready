/**
 * The sign-in page asks Supabase which providers are on rather than assuming.
 * Every failure has to land on "off", because the cost of a false positive is
 * a person clicking through to a raw JSON 400 on someone else's domain.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-key';

const { authProviders } = await import('../lib/auth-providers');

function answer(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('authProviders', () => {
  it('reports google on only when Supabase says exactly true', async () => {
    answer({ external: { google: true, email: true } });
    expect(await authProviders()).toEqual({ google: true });
  });

  it('treats a missing provider as off', async () => {
    answer({ external: { email: true } });
    expect(await authProviders()).toEqual({ google: false });
  });

  it('treats a truthy non-boolean as off rather than guessing', async () => {
    answer({ external: { google: 'true' } });
    expect(await authProviders()).toEqual({ google: false });
  });

  it('is off when the settings endpoint refuses', async () => {
    answer({ message: 'No API key found in request' }, false);
    expect(await authProviders()).toEqual({ google: false });
  });

  it('is off when the request throws, rather than propagating', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    await expect(authProviders()).resolves.toEqual({ google: false });
  });

  it('is off when the body is not the shape we expect', async () => {
    answer({ nothing: 'useful' });
    expect(await authProviders()).toEqual({ google: false });
  });
});
