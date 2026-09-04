/**
 * The buyer gets the files in the message.
 *
 * Before this, the purchase email carried a link and the link needed a session
 * — and once sign-in became Google-only, someone whose Stripe address is not a
 * Google account could pay and never reach what they bought. These assert the
 * two things that keep that closed: the attachment exists, and it is the same
 * archive the download route serves.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assembleFixPack } from '../lib/fixpack';
import type { ScanView } from '../lib/scan-data';

// The fixture is the CheckResult[] itself, not an object wrapping one.
const results = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../packages/core/__fixtures__/waf-blocked-spa.json', import.meta.url)), 'utf8'),
) as ScanView['results'];

function view(): ScanView {
  return {
    scan: { finished_at: '2026-09-01T10:00:00Z', created_at: '2026-09-01T10:00:00Z', scanner_version: '1.1.0' },
    site: { domain: 'example.com' },
    results,
    score: { scoringVersion: '1.2' },
    findings: [],
    passing: [],
  } as unknown as ScanView;
}

describe('the fix pack a buyer receives', () => {
  it('assembles an archive with every file the README promises', () => {
    const pack = assembleFixPack(view(), 'scan-1')!;
    expect(pack).not.toBeNull();
    expect(pack.filename).toBe('botready-fixpack-example.com.zip');
    expect(pack.names).toContain('README.md');
    expect(pack.names).toContain('punch-list.md');
    expect(pack.names).toContain('botready-fixes.md');
    expect(pack.archive.byteLength).toBeGreaterThan(200);
  });

  it('is byte-identical whichever way the buyer gets it', () => {
    // The email and the download route call the same function, which is the
    // whole point of the function: two copies of this assembly drifted once.
    const a = assembleFixPack(view(), 'scan-1')!;
    const b = assembleFixPack(view(), 'scan-1')!;
    expect(Buffer.from(a.archive).equals(Buffer.from(b.archive))).toBe(true);
  });

  it('is a real zip, so a mail client will open it', () => {
    const pack = assembleFixPack(view(), 'scan-1')!;
    // Local file header. Without this the attachment is a blob nobody can read.
    expect(Buffer.from(pack.archive.slice(0, 4))).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('exposes every file on its own, so the email can attach them unzipped', () => {
    // A .md inside a zip cannot be read on a phone. The prompt is the piece a
    // buyer most wants straight into an editor, so it travels as a file.
    const pack = assembleFixPack(view(), 'scan-1')!;
    expect(pack.entries.length).toBe(pack.names.length);
    expect(pack.entries.map((e) => e.name)).toContain('botready-fixes.md');
    expect(pack.entries.every((e) => e.content.length > 0)).toBe(true);
    expect(pack.agentPrompt.length).toBeGreaterThan(400);
    expect(pack.punchList).toContain('#');
  });

  it('declines rather than sending an empty archive for an unscored scan', () => {
    const unscored = { ...view(), score: null };
    expect(assembleFixPack(unscored, 'scan-1')).toBeNull();
  });
});
