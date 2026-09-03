/**
 * The zip writer produces something every unzip opens. Rather than trusting
 * the field offsets, the archive is written to disk and read back with the
 * system's own unzip, which is the reader that matters.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { crc32, zip } from '../lib/zip';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function hasUnzip(): boolean {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('crc32', () => {
  it('matches the reference values', () => {
    const enc = new TextEncoder();
    // The canonical check value for CRC-32.
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(enc.encode('a'))).toBe(0xe8b7be43);
  });
});

describe('zip', () => {
  const when = new Date('2026-09-02T14:02:00Z');

  it('starts with a local header and ends with the end-of-central-directory record', () => {
    const bytes = zip([{ name: 'a.txt', content: 'hello', modified: when }]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(1); // entries
  });

  it('is deterministic for the same input and timestamp', () => {
    const a = zip([{ name: 'a.txt', content: 'hello', modified: when }]);
    const b = zip([{ name: 'a.txt', content: 'hello', modified: when }]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it.skipIf(!hasUnzip())('round-trips through the system unzip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'botready-zip-'));
    dirs.push(dir);

    const files = [
      { name: 'llms.txt', content: '# Example\n> A site.\n\n## Pricing\n- [Pricing](https://example.com/pricing)\n' },
      { name: 'robots.txt', content: 'User-agent: *\nAllow: /\n' },
      { name: 'nested/punch-list.md', content: '# What to fix\n\n— with a non-ASCII dash\n' },
    ];

    const archive = join(dir, 'pack.zip');
    writeFileSync(archive, zip(files.map((f) => ({ ...f, modified: when }))));

    // -t tests every CRC; a mismatch fails the command.
    execFileSync('unzip', ['-t', archive], { stdio: 'pipe' });
    execFileSync('unzip', ['-o', '-q', archive, '-d', join(dir, 'out')]);

    for (const file of files) {
      expect(readFileSync(join(dir, 'out', file.name), 'utf8')).toBe(file.content);
    }
  });
});
