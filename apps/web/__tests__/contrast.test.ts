/**
 * The palette, measured rather than eyeballed.
 *
 * Colour in this product maps to HTTP status classes and that mapping is
 * load-bearing, which makes an unreadable status colour a correctness bug and
 * not a taste question. Two of the original values did not clear WCAG AA
 * against our own page background; this file is what stops them drifting back.
 *
 * The values are read out of tokens.css rather than restated here, so a change
 * to the palette fails this test instead of quietly passing it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const tokens = readTokens();

function readTokens(): Record<string, string> {
  const css = readFileSync(fileURLToPath(new URL('../app/tokens.css', import.meta.url)), 'utf8');
  const found: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    if (match[1] && match[2]) found[match[1]] = match[2].toUpperCase();
  }
  return found;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const first = tokens[a];
  const second = tokens[b];
  if (!first || !second) throw new Error(`tokens.css has no --color-${first ? b : a}`);
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** WCAG AA for text under 18.66px bold or 24px regular, which is all of ours. */
const AA_NORMAL = 4.5;
/** WCAG AA for large text, and for the 3px status borders on the findings. */
const AA_LARGE = 3;

describe('tokens.css defines the palette this test measures', () => {
  it('has every colour the components reference', () => {
    for (const name of [
      'ink',
      'ink-60',
      'ink-30',
      'paper',
      'card',
      'rule',
      'sheet',
      'pass',
      'warn',
      'fail',
      'server',
      'fail-dark',
      'ink-key',
      'ink-seg',
    ]) {
      expect(tokens[name], `--color-${name} is missing`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('text on the page surfaces clears WCAG AA', () => {
  // paper is the page, card is a raised panel. Every readable word in the
  // product sits on one of the two.
  const surfaces = ['paper', 'card'] as const;
  const textColours = ['ink', 'ink-60', 'pass', 'warn', 'fail', 'server'] as const;

  for (const surface of surfaces) {
    for (const text of textColours) {
      it(`${text} on ${surface}`, () => {
        const ratio = contrast(text, surface);
        expect(
          ratio,
          `--color-${text} on --color-${surface} is ${ratio.toFixed(2)}:1, and AA needs ${AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe('text on the inverted grade block clears WCAG AA', () => {
  // The grade block is the only inverted surface, and it has its own pair of
  // readable colours because the light-surface ones are unreadable there.
  for (const text of ['paper', 'fail-dark', 'ink-key', 'ink-30'] as const) {
    it(`${text} on ink`, () => {
      const ratio = contrast(text, 'ink');
      expect(ratio, `--color-${text} on ink is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  }
});

describe('the colours that are not text', () => {
  it('ink-30 is too light for text, which is why nothing uses it for text', () => {
    // Asserted rather than assumed: if somebody lightens ink-60 to ink-30's
    // value the test above stops meaning anything, and this documents why the
    // token exists at all.
    expect(contrast('ink-30', 'paper')).toBeLessThan(AA_NORMAL);
  });

  it('rule is visible as a hairline without pretending to be readable', () => {
    expect(contrast('rule', 'paper')).toBeLessThan(AA_LARGE);
    expect(contrast('rule', 'paper')).toBeGreaterThan(1.2);
  });

  it('the status borders on the findings are distinguishable from the card', () => {
    // A 3px left border is a graphical object: AA asks for 3:1.
    for (const status of ['pass', 'warn', 'fail', 'server'] as const) {
      const ratio = contrast(status, 'card');
      expect(ratio, `--color-${status} against card is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    }
  });

  it('the empty meter segment reads against the filled one', () => {
    expect(contrast('ink-seg', 'ink')).toBeGreaterThan(1.15);
    expect(contrast('fail-dark', 'ink-seg')).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('nothing in the app sets text in a colour too light to read', () => {
  it('no component uses text-ink-30 or text-rule', () => {
    // The static half of the guarantee, so a new component cannot reintroduce
    // the problem in a state the axe run does not happen to visit.
    const files = walk(fileURLToPath(new URL('..', import.meta.url)));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\b(?:placeholder:)?text-(ink-30|rule)\b/g)) {
        offenders.push(`${file.split('/apps/web/')[1]}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  // Deliberately not importing a helper: this file is the one that must keep
  // working when everything else is being refactored.
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) return [];
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : [];
  });
}
