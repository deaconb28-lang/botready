/**
 * No env file reaches the repository.
 *
 * The rule used to be three patterns — .env, .env.local, .env*.local — which
 * left .env.production, .env.development and .env.test visible to git. Next.js
 * reads all three natively, so they are files people really create and really
 * fill with real keys, and the failure is silent until the moment it is not.
 *
 * This asks git rather than reading .gitignore, because git is the thing that
 * decides. A pattern that looks right and does not match is exactly the bug.
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const REPO = new URL('../../../', import.meta.url).pathname;

/** What git would do with a path, without needing the file to exist. */
function ignored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const SHOULD_BE_IGNORED = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.test',
  '.env.staging',
  // The two names a hurried backup gets, both of which hold everything the
  // real file held.
  '.env.backup',
  '.env.old',
  // Every workspace, because a key pasted into the package that needs it is
  // the obvious place to paste it.
  'apps/web/.env',
  'apps/web/.env.production',
  'apps/scanner/.env',
  'apps/scanner/.env.local',
  'packages/core/.env',
  'db/.env',
  'tools/.env',
];

describe('env files', () => {
  it.each(SHOULD_BE_IGNORED)('git ignores %s', (path) => {
    expect(ignored(path)).toBe(true);
  });

  it('keeps .env.example, which is the point of having an example', () => {
    expect(ignored('.env.example')).toBe(false);
  });

  it('has never committed anything but the example', () => {
    const added = execFileSync(
      'git',
      ['log', '--all', '--pretty=format:', '--name-only', '--diff-filter=A'],
      { cwd: REPO, encoding: 'utf8' },
    );
    const envFiles = [...new Set(added.split('\n').filter((f) => /(^|\/)\.env/.test(f)))];
    expect(envFiles).toEqual(['.env.example']);
  });

  it('the example holds no secret, only shapes', () => {
    const example = execFileSync('git', ['show', 'HEAD:.env.example'], { cwd: REPO, encoding: 'utf8' });
    // The prefixes are deliberate: a reader should recognise the shape of what
    // goes there. What must never follow one is an actual key.
    expect(example).not.toMatch(/sk_live_[A-Za-z0-9]/);
    expect(example).not.toMatch(/whsec_[A-Za-z0-9]/);
    expect(example).not.toMatch(/\bre_[A-Za-z0-9]{8,}/);
    expect(example).not.toMatch(/\bsbp_[a-f0-9]{20,}/);
    expect(example).not.toMatch(/GOCSPX-[A-Za-z0-9]/);
    expect(example).not.toMatch(/\bsk-ant-[A-Za-z0-9]/);
    // A Supabase service role key is a JWT, and its header is always this.
    expect(example).not.toMatch(/eyJhbGciOi/);
  });
});
