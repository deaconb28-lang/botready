/**
 * Who gets in.
 *
 * This gate stands in front of every scan, every customer address and every
 * purchase on the platform, so the interesting cases are all the ones where it
 * should say no. The one that matters most is an unconfigured environment:
 * an empty allowlist has to admit nobody, because the alternative is that
 * forgetting a variable publishes the business.
 */

import { describe, expect, it } from 'vitest';

import { isAdminEmail } from '../lib/admin';

const ALLOWED = ['owner@example.com', 'second@example.com'];

describe('the admin allowlist', () => {
  it('lets a listed address in', () => {
    expect(isAdminEmail('owner@example.com', ALLOWED)).toBe(true);
    expect(isAdminEmail('second@example.com', ALLOWED)).toBe(true);
  });

  it('ignores case and surrounding space, which is how addresses get typed', () => {
    expect(isAdminEmail('  Owner@Example.COM ', ALLOWED)).toBe(true);
  });

  it('keeps everybody else out', () => {
    expect(isAdminEmail('someone@example.com', ALLOWED)).toBe(false);
    expect(isAdminEmail('owner@example.com.evil.test', ALLOWED)).toBe(false);
    expect(isAdminEmail('owner@example', ALLOWED)).toBe(false);
  });

  it('admits nobody when the list is empty, which is the whole point', () => {
    // An unset ADMIN_EMAILS must shut the door rather than open it. Every other
    // variable here degrades a feature when it is missing; this one would
    // publish every customer's address.
    expect(isAdminEmail('owner@example.com', [])).toBe(false);
    expect(isAdminEmail('anyone@example.com', [])).toBe(false);
  });

  it('admits nobody for a missing address', () => {
    expect(isAdminEmail(null, ALLOWED)).toBe(false);
    expect(isAdminEmail(undefined, ALLOWED)).toBe(false);
    expect(isAdminEmail('', ALLOWED)).toBe(false);
    expect(isAdminEmail('   ', ALLOWED)).toBe(false);
  });
});
