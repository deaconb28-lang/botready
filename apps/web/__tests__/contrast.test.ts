/**
 * The palette, measured rather than eyeballed.
 *
 * Colour in this product carries meaning — lime is pass, coral is fail, amber
 * is warn, violet is the brand, and a status chip is read as a status — which
 * makes an unreadable pair a correctness bug and not a taste question. The
 * values are read out of tokens.css rather than restated here, so a change to
 * the palette fails this test instead of quietly passing it.
 *
 * The design's own rule, from the handoff: text on coral, lime, amber, teal
 * and pink is always ink; text on violet and green is always white. Each of
 * those pairs is measured below.
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
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const first = tokens[a];
  const second = tokens[b];
  if (!first) throw new Error(`tokens.css has no --color-${a}`);
  if (!second) throw new Error(`tokens.css has no --color-${b}`);
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** WCAG AA for text under 18.66px bold or 24px regular, which is most of ours. */
const AA_NORMAL = 4.5;
/** WCAG AA for large text: headings, grades, the big numbers. */
const AA_LARGE = 3;

const WHITE = 'surface';

describe('tokens.css defines the palette this test measures', () => {
  it('has every colour the components reference', () => {
    for (const name of [
      'canvas',
      'surface',
      'surface-alt',
      'ink',
      'body',
      'muted',
      'subtle',
      'subtle-2',
      'placeholder',
      'quiet',
      'violet',
      'violet-tint',
      'lime',
      'lime-tint',
      'coral',
      'coral-tint',
      'coral-text',
      'coral-dark',
      'amber',
      'amber-tint',
      'amber-text',
      'green',
      'green-tint',
      'green-text',
      'teal',
      'pink',
      'rule',
    ]) {
      expect(tokens[name], `--color-${name} is missing`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('body text clears WCAG AA on every surface it sits on', () => {
  // canvas is the page, surface is a white card, surface-alt is an inset field.
  for (const surface of ['canvas', 'surface', 'surface-alt', 'paper', 'lime-tint', 'coral-tint', 'amber-tint', 'green-tint', 'violet-tint']) {
    for (const text of ['ink', 'body', 'muted']) {
      it(`${text} on ${surface}`, () => {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe('the status colours are readable where they are used as text', () => {
  it('coral-text on white, for a failing finding', () => {
    expect(contrast('coral-text', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('coral-text on its own tint, for the alert block', () => {
    expect(contrast('coral-text', 'coral-tint')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('green-text on white and on its own tint', () => {
    expect(contrast('green-text', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast('green-text', 'green-tint')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('amber-text on white, for a warning', () => {
    expect(contrast('amber-text', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('violet on white, for links and the fix chip', () => {
    expect(contrast('violet', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast('violet', 'violet-chip')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('coral-dark on ink, the only place fail is set on the dark surface', () => {
    expect(contrast('coral-dark', 'ink')).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('the design rule: ink on the bright fills, white on violet and green', () => {
  // "Text on coral, lime, amber, teal and pink is always ink."
  for (const fill of ['coral', 'lime', 'amber', 'teal', 'pink']) {
    it(`ink on ${fill}`, () => {
      expect(contrast('ink', fill)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`white on ${fill} is NOT used, and this is why`, () => {
      expect(contrast('surface', fill)).toBeLessThan(AA_NORMAL);
    });
  }

  // "Text on violet and green is always white."
  for (const fill of ['violet', 'green']) {
    it(`white on ${fill}`, () => {
      expect(contrast('surface', fill)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }

  it('white on coral fails even the large-text floor, which is why the grade is ink there', () => {
    // The prototype drew the 88px coral grade in white. It measures below 3:1,
    // so the app renders it in ink, as the handoff's own rule says.
    expect(contrast('surface', 'coral')).toBeLessThan(AA_LARGE);
    expect(contrast('ink', 'coral')).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('secondary text on the dark and violet surfaces', () => {
  it('on-violet, the supporting copy inside a violet panel', () => {
    expect(contrast('on-violet', 'violet')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('lime on violet, the eyebrow inside the race panel', () => {
    expect(contrast('lime', 'violet')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('on-ink and on-ink-3, the terminal and code-viewer body text', () => {
    expect(contrast('on-ink', 'ink')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast('on-ink-3', 'ink')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('lime on ink, the terminal prompt', () => {
    expect(contrast('lime', 'ink')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('the muted labels on ink clear the floor for the sizes they are used at', () => {
    // on-ink-label is a 12px mono eyebrow; on-ink-muted is 11.5px metadata.
    expect(contrast('on-ink-label', 'ink')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast('on-ink-muted', 'ink')).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('the quiet greys are readable at the sizes they are used', () => {
  // subtle-2 and placeholder are mono metadata at 11.5-13px on white or canvas.
  // These carry words — a status line, a table header, a timestamp — so they
  // are held to the normal-text floor on every surface they appear on.
  for (const grey of ['subtle', 'subtle-2', 'placeholder', 'quiet']) {
    for (const surface of ['surface', 'canvas', 'surface-alt', 'paper']) {
      it(`${grey} on ${surface}`, () => {
        expect(contrast(grey, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

  it('rule and divider are never text: they measure below the floor and that is what they are for', () => {
    expect(contrast('rule', WHITE)).toBeLessThan(AA_LARGE);
    expect(contrast('divider', WHITE)).toBeLessThan(AA_LARGE);
  });
});
