import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

import type { CheckStatus, Finding, Grade } from '@botready/core';

/**
 * The share card. One grade, one fact, one domain.
 *
 * This is the unit that travels, so it was designed before the marketing site.
 * The fact is drawn from the worst finding, which means the thing that gets
 * forwarded is a measurement rather than a slogan.
 *
 * Rendered from plain data rather than from a scan row, so that the fixture
 * preview at /api/og/preview/[fixture] produces the identical image. A share
 * card is the hardest thing in the product to look at — it only exists inside
 * somebody else's link unfurler — so being able to open one directly matters.
 */

/** What every card reader wants. */
export const CARD_SIZE = { width: 1200, height: 630 } as const;

export interface CardData {
  domain: string;
  checkedAt: string;
  /** Null for a blocked or errored scan, which still gets a card. */
  grade: Grade | null;
  total: number | null;
  scoringVersion: string | null;
  /** The one fact, already written. */
  headline: string;
  /** The supporting line along the bottom. */
  secondary: string;
}

export async function renderShareCard(data: CardData): Promise<ImageResponse> {
  const [display, mono] = await Promise.all([
    loadFont('Archivo-ExtraBold.ttf'),
    loadFont('JetBrainsMono-Regular.ttf'),
  ]);

  const fonts = [
    ...(display
      ? [{ name: 'Archivo', data: display, weight: 800 as const, style: 'normal' as const }]
      : []),
    ...(mono
      ? [{ name: 'JetBrainsMono', data: mono, weight: 400 as const, style: 'normal' as const }]
      : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#16181C',
          color: '#E4E6E1',
          padding: '48px 54px',
          fontFamily: 'JetBrainsMono, monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 15, fontWeight: 700 }}>
          <span>botready</span>
          <span style={{ color: '#F0705C' }}>.dev</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 15, color: '#8E948C' }}>
            {data.domain} · agent readability
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginTop: 6 }}>
            {data.grade ? (
              <div
                style={{
                  fontFamily: 'Archivo, sans-serif',
                  fontWeight: 800,
                  fontSize: 120,
                  lineHeight: 0.85,
                  letterSpacing: '-0.03em',
                  // The letter's descender-free bowl sits lower than the
                  // headline's baseline at this size, so it is nudged up to
                  // meet it rather than left to align on the box.
                  paddingBottom: 16,
                  color: gradeColour(data.grade),
                }}
              >
                {data.grade}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                fontFamily: 'Archivo, sans-serif',
                fontWeight: 800,
                fontSize: data.headline.length > 34 ? 44 : 56,
                lineHeight: 1.02,
                letterSpacing: '-0.03em',
                paddingBottom: 10,
                maxWidth: data.grade ? 780 : 1060,
              }}
            >
              {data.headline}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 15, color: '#8E948C' }}>
          {[
            data.secondary,
            data.total !== null && data.scoringVersion
              ? `${data.total}/100 · scoring v${data.scoringVersion}`
              : null,
            `checked ${data.checkedAt}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      ...(fonts.length > 0 ? { fonts } : {}),
      headers: {
        // A finished scan's card never changes.
        'cache-control': 'public, immutable, no-transform, max-age=31536000',
      },
    },
  );
}

/**
 * The one fact, from the facts. Prefers the parity finding because a status
 * disagreement is the product's whole argument and the most surprising thing on
 * most cards; falls back to whatever cost the most points.
 */
export function cardCopy(input: {
  perAgent: Record<string, { status: number }>;
  controlId: string;
  findings: Finding[];
  ratio: { value: number; status: CheckStatus } | null;
  checksTotal: number;
}): { headline: string; secondary: string } {
  const clients = Object.keys(input.perAgent).length;
  const refused = Object.entries(input.perAgent).filter(([, f]) => f.status >= 400);

  const headline =
    refused.length > 0 && clients > 0
      ? `${refused.length} of ${clients} clients get a ${refused[0]?.[1].status ?? 403}.`
      : input.findings[0]
        ? sentence(input.findings[0].headline)
        : 'Every check passed.';

  const secondary =
    input.ratio && input.ratio.status !== 'error'
      ? `${Math.round(input.ratio.value * 100)}% of the page text needs JavaScript`
      : `${input.findings.length} of ${input.checksTotal} checks did not pass`;

  return { headline, secondary };
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function gradeColour(grade: Grade): string {
  // The same three bands as everywhere else. Paper for a pass, because the pass
  // green is too dark to read at 120px on the ink surface.
  if (grade === 'A' || grade === 'B') return '#E4E6E1';
  if (grade === 'C') return '#D69A5C';
  return '#F0705C';
}

export function formatCardDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The two faces, read from disk once per cold start and held.
 *
 * Fetching them from a font CDN was the first version of this, and it broke
 * when Google bumped the family's version path. The card is the unit that
 * travels, so it does not get to depend on somebody else's URL. If a read
 * fails the card still renders in next/og's default face rather than 500ing:
 * a card in the wrong font is a small problem and a missing card is the
 * distribution model.
 */
const fontCache = new Map<string, Buffer | null>();

async function loadFont(file: string): Promise<Buffer | null> {
  const cached = fontCache.get(file);
  if (cached !== undefined) return cached;
  try {
    // Traced into the deployment by outputFileTracingIncludes in next.config.ts.
    const data = await readFile(join(process.cwd(), 'assets', 'fonts', file));
    fontCache.set(file, data);
    return data;
  } catch {
    fontCache.set(file, null);
    return null;
  }
}
