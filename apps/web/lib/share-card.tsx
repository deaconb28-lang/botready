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
 *
 * The look is the site's: lavender canvas, a white panel with a 2px ink border
 * and a hard offset shadow, the grade in a coral or green tile. Satori draws
 * box-shadow badly, so the shadow is a second rectangle behind the panel.
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

/* The same values as app/tokens.css. next/og cannot read CSS variables, so the
   handful the card uses are repeated here. */
const C = {
  canvas: '#EDEBFB',
  surface: '#FFFFFF',
  ink: '#111318',
  muted: '#5A646F',
  subtle: '#8B90A0',
  violet: '#4B44F5',
  lime: '#C6F53C',
  coral: '#FF6B5A',
  green: '#2E9B5E',
} as const;

const PANEL = { inset: 44, shadow: 8, border: 2, pad: 44 } as const;

export async function renderShareCard(data: CardData): Promise<ImageResponse> {
  const [display, body, mono] = await Promise.all([
    loadFont('FamiljenGrotesk-Bold.ttf'),
    loadFont('PublicSans-Regular.ttf'),
    loadFont('JetBrainsMono-Regular.ttf'),
  ]);

  const fonts = [
    ...(display
      ? [{ name: 'FamiljenGrotesk', data: display, weight: 700 as const, style: 'normal' as const }]
      : []),
    ...(body ? [{ name: 'PublicSans', data: body, weight: 400 as const, style: 'normal' as const }] : []),
    ...(mono
      ? [{ name: 'JetBrainsMono', data: mono, weight: 400 as const, style: 'normal' as const }]
      : []),
  ];

  const displayFace = 'FamiljenGrotesk, sans-serif';
  const bodyFace = 'PublicSans, sans-serif';
  const monoFace = 'JetBrainsMono, monospace';

  const healthy = data.grade === 'A' || data.grade === 'B';
  const tile = tileLabel(data);
  const tileBg = healthy ? C.green : C.coral;
  const tileFg = healthy ? C.surface : C.ink;

  const panelWidth = CARD_SIZE.width - PANEL.inset * 2 - PANEL.shadow;
  const panelHeight = CARD_SIZE.height - PANEL.inset * 2 - PANEL.shadow;

  const meta = [
    data.scoringVersion ? `scoring v${data.scoringVersion}` : null,
    `checked ${data.checkedAt}`,
    'botready.dev',
  ]
    .filter(Boolean)
    .join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: C.canvas,
          color: C.ink,
          fontFamily: bodyFace,
        }}
      >
        {/* The hard shadow: the same rectangle, offset, in ink. */}
        <div
          style={{
            position: 'absolute',
            left: PANEL.inset + PANEL.shadow,
            top: PANEL.inset + PANEL.shadow,
            width: panelWidth,
            height: panelHeight,
            background: C.ink,
            borderRadius: 20,
          }}
        />

        {/* The panel. */}
        <div
          style={{
            position: 'absolute',
            left: PANEL.inset,
            top: PANEL.inset,
            width: panelWidth,
            height: panelHeight,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: C.surface,
            border: `${PANEL.border}px solid ${C.ink}`,
            borderRadius: 20,
            padding: PANEL.pad,
          }}
        >
          {/* Top row: the domain, and the mark. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: monoFace,
                fontSize: 22,
                color: C.ink,
                maxWidth: 880,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {data.domain}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  background: C.violet,
                  border: `2px solid ${C.ink}`,
                  borderRadius: 11,
                  fontFamily: monoFace,
                  fontSize: 22,
                  color: C.lime,
                  // Mono has no bold instance on the card; the lime on violet
                  // carries the mark at this size.
                  lineHeight: 1,
                  paddingBottom: 2,
                }}
              >
                b
              </div>
              <div style={{ display: 'flex', fontFamily: displayFace, fontSize: 24, letterSpacing: '-0.02em' }}>
                BotReady
              </div>
            </div>
          </div>

          {/* Middle: the grade tile and the fact. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: 220,
                height: 220,
                background: tileBg,
                color: tileFg,
                border: `2px solid ${C.ink}`,
                borderRadius: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontFamily: displayFace,
                  fontSize: tile.length > 2 ? 84 : 132,
                  lineHeight: 1,
                  letterSpacing: '-0.035em',
                }}
              >
                {tile}
              </div>
              <div
                style={{
                  display: 'flex',
                  marginTop: 10,
                  fontFamily: monoFace,
                  fontSize: 15,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.9,
                }}
              >
                {data.grade ? 'Grade' : 'Not read'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
              {data.total !== null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      fontFamily: displayFace,
                      fontSize: 64,
                      lineHeight: 1,
                      letterSpacing: '-0.035em',
                    }}
                  >
                    {data.total}
                  </div>
                  <div style={{ display: 'flex', fontFamily: monoFace, fontSize: 22, color: C.subtle }}>/ 100</div>
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  fontFamily: bodyFace,
                  fontSize: data.headline.length > 48 ? 34 : 40,
                  lineHeight: 1.25,
                  color: C.ink,
                  maxWidth: 800,
                }}
              >
                {data.headline}
              </div>
              {data.secondary ? (
                <div
                  style={{
                    display: 'flex',
                    marginTop: 14,
                    fontFamily: bodyFace,
                    fontSize: 22,
                    lineHeight: 1.35,
                    color: C.muted,
                    maxWidth: 800,
                  }}
                >
                  {data.secondary}
                </div>
              ) : null}
            </div>
          </div>

          {/* Bottom: the metadata line. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: monoFace,
              fontSize: 17,
              color: C.subtle,
            }}
          >
            <div style={{ display: 'flex' }}>{meta}</div>
            <div style={{ display: 'flex', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 14 }}>
              Agent readability
            </div>
          </div>
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
 * What the tile says. The grade when there is one; the status code that
 * refused us when the headline names one; a dash when the scan simply could
 * not finish.
 */
function tileLabel(data: CardData): string {
  if (data.grade) return data.grade;
  const code = /\b(4\d\d|5\d\d)\b/.exec(data.headline)?.[1];
  if (code) return code;
  return /refuses|blocked|403/i.test(data.headline) ? '403' : '—';
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
 * The three faces, read from disk once per cold start and held.
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
