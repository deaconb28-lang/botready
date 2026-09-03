/**
 * packages/core is shared and framework-free, and that is a property somebody
 * has to keep true. It is easy to reach for `fs` in a remedy generator or pull a
 * type in from the worker, and either one breaks the two things this package
 * exists for: the web app bundling it for the browser, and the scoring function
 * being runnable over stored evidence with nothing else present.
 *
 * These tests read the source rather than the build, because there is no build.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const coreRoot = fileURLToPath(new URL('..', import.meta.url));
const srcRoot = join(coreRoot, 'src');
const repoRoot = join(coreRoot, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** Every module specifier a file imports or re-exports. */
function specifiers(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

describe('packages/core imports nothing from outside packages/core', () => {
  const files = sourceFiles(srcRoot);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files.map((f) => [relative(coreRoot, f), f] as const))(
    '%s imports only relative paths',
    (_label, file) => {
      for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
        expect(
          specifier.startsWith('./') || specifier.startsWith('../'),
          `${relative(coreRoot, file)} imports ${specifier}, which is not inside packages/core`,
        ).toBe(true);
      }
    },
  );

  it.each(files.map((f) => [relative(coreRoot, f), f] as const))(
    '%s does not reach out of the package with a relative path either',
    (_label, file) => {
      for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
        const resolved = join(file, '..', specifier);
        expect(
          resolved.startsWith(coreRoot),
          `${relative(coreRoot, file)} imports ${specifier}, which resolves outside packages/core`,
        ).toBe(true);
      }
    },
  );

  it('declares no runtime dependencies', () => {
    const manifest = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies ?? {}).toEqual({});
  });

  it('touches neither the filesystem, the network, nor the clock', () => {
    // A pure function of its arguments, so that scoring stored evidence a year
    // from now gives the number that is on the page today.
    const forbidden = [
      /\bnode:fs\b/,
      /\bnode:net\b/,
      /\bnode:http\b/,
      /\bfetch\s*\(/,
      /\bDate\.now\s*\(/,
      /\bnew Date\s*\(\s*\)/,
      /\bMath\.random\s*\(/,
      /\bprocess\.env\b/,
    ];
    for (const file of sourceFiles(srcRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${relative(coreRoot, file)} matches ${pattern}`).toBe(false);
      }
    }
  });
});

describe('the scanner emits nothing the catalog does not carry', () => {
  /**
   * The static half of the guarantee. The end-to-end scan test asserts the same
   * thing against a real scan; this one catches a typo in a check key without
   * waiting for Chromium, and it reads the whole scanner rather than only the
   * paths one fixture happened to exercise.
   */
  it('every key: literal in the scanner is in checks.json', () => {
    const catalog = JSON.parse(readFileSync(join(coreRoot, 'checks.json'), 'utf8')) as {
      checks: Array<{ key: string }>;
    };
    const known = new Set(catalog.checks.map((c) => c.key));

    const scannerSrc = join(repoRoot, 'apps', 'scanner', 'src');
    const emitted = new Set<string>();
    for (const file of sourceFiles(scannerSrc)) {
      if (file.endsWith('.test.ts')) continue;
      for (const match of readFileSync(file, 'utf8').matchAll(/\bkey:\s*'([a-z0-9_]+)'/g)) {
        if (match[1]) emitted.add(match[1]);
      }
    }

    expect(emitted.size).toBeGreaterThan(15);
    for (const key of emitted) {
      expect(known, `the scanner emits ${key}, which is not in checks.json`).toContain(key);
    }
  });

  it('never mentions a point value or a grade', () => {
    // Evidence and scoring are separate. If the scanner knew what a check was
    // worth, changing a weight would mean re-crawling the internet.
    const scannerSrc = join(repoRoot, 'apps', 'scanner', 'src');
    for (const file of sourceFiles(scannerSrc)) {
      if (file.endsWith('.test.ts') || file.includes('__fixtures__')) continue;
      const code = readFileSync(file, 'utf8')
        // Comments are allowed to explain the catalog's thresholds.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      expect(code, `${relative(repoRoot, file)} imports the scoring function`).not.toMatch(
        /\b(score|scoreDetail|pointsLost|gradeFor)\b/,
      );
      expect(code, `${relative(repoRoot, file)} mentions points`).not.toMatch(/\.points\b/);
      expect(code, `${relative(repoRoot, file)} mentions a grade`).not.toMatch(/\bgrades?\b/i);
    }
  });
});

describe('the worker and the web app agree on who we are', () => {
  it('uses one user agent string, in both places', () => {
    // The string points at /bot, and /bot tells people how to block it. A user
    // agent that does not match the page it names is a broken promise.
    const scannerVersion = readFileSync(
      join(repoRoot, 'apps', 'scanner', 'src', 'version.ts'),
      'utf8',
    );
    const webSite = readFileSync(join(repoRoot, 'apps', 'web', 'lib', 'site.ts'), 'utf8');

    const extract = (source: string) =>
      /USER_AGENT\s*=\s*'([^']+)'/.exec(source)?.[1] ??
      `no USER_AGENT found in ${source.slice(0, 40)}`;

    expect(extract(webSite)).toBe(extract(scannerVersion));
    expect(extract(scannerVersion)).toBe('BotreadyBot/1.0 (+https://botready.dev/bot)');
  });

  it('agrees on the page cap and the delay', () => {
    const scannerVersion = readFileSync(
      join(repoRoot, 'apps', 'scanner', 'src', 'version.ts'),
      'utf8',
    );
    const webSite = readFileSync(join(repoRoot, 'apps', 'web', 'lib', 'site.ts'), 'utf8');

    expect(/MAX_PAGES_PER_SCAN\s*=\s*(\d+)/.exec(scannerVersion)?.[1]).toBe('6');
    expect(/maxPagesPerScan:\s*(\d+)/.exec(webSite)?.[1]).toBe('6');
    expect(/pageDelayMs:\s*(\d+)/.exec(webSite)?.[1]).toBe('1000');
    // The delay is 1000 in production whatever the environment says.
    expect(scannerVersion).toMatch(/NODE_ENV === 'production'\) return 1000/);
  });
});
