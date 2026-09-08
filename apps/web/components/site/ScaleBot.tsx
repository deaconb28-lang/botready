/**
 * The mascot asking every engine at once.
 *
 * Same anatomy as the bot everywhere else — rounded-rect head, 2.5px ink
 * outline, circle eyes, antenna with a lit bulb — because this is the same
 * character and a second robot with different proportions would read as a
 * stock illustration rather than as ours.
 *
 * What it draws is the tier's actual claim: one question goes up, several
 * engines answer, and the answers come back ranked and side by side. That is
 * the difference between this plane and the scan, and it is a shape rather
 * than a sentence, so it is worth drawing.
 *
 * Decorative but not silent: the label says what the picture shows, because
 * the surrounding copy describes the plan rather than the diagram, and a
 * reader who cannot see it would otherwise not know a diagram was there.
 *
 * Elevation is a duplicated shape offset by 3px in ink rather than a filter.
 * The system has no blur anywhere and an SVG drop-shadow would be the only
 * soft edge on the site.
 */

const INK = '#111318';
const WHITE = '#FFFFFF';
const LIME = '#C6F53C';
const VIOLET = '#4B44F5';
const PAPER = '#EDEBFB';
const RULE = '#D9D9D2';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

/** One engine's answer, ranked. Three of these are the whole picture. */
const CARDS = [
  { x: 6, y: 30, rotate: -5, rank: '1', accent: LIME, on: INK },
  // White on violet, ink on lime and on the tint. The same rule as everywhere
  // else in the system, and it is a rule because ink on violet measures 3.05:1
  // — under AA for text, and the first version of this drew the numeral that
  // way. White on the same violet is 6.10:1.
  { x: 104, y: 16, rotate: 0, rank: '2', accent: VIOLET, on: WHITE },
  { x: 202, y: 32, rotate: 5, rank: '3', accent: PAPER, on: INK },
] as const;

export function ScaleBot({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 232"
      width="100%"
      className={className}
      role="img"
      aria-label="One question going up to three answer engines, and three ranked answers coming back side by side"
    >
      {/* Asked before answered, so the dotted lines sit under the cards. */}
      <g stroke={INK} strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M150 128Q104 118 60 86" />
        <path d="M150 126V74" />
        <path d="M150 128q46-10 90-42" />
      </g>

      {CARDS.map((card) => (
        <Answer key={card.rank} {...card} />
      ))}

      <Bot />
    </svg>
  );
}

function Answer({
  x,
  y,
  rotate,
  rank,
  accent,
  on,
}: {
  x: number;
  y: number;
  rotate: number;
  rank: string;
  accent: string;
  on: string;
}) {
  const w = 92;
  const h = 58;
  return (
    <g transform={`rotate(${rotate} ${x + w / 2} ${y + h / 2})`}>
      <rect x={x + 3} y={y + 3} width={w} height={h} rx="11" fill={INK} />
      <rect x={x} y={y} width={w} height={h} rx="11" fill={WHITE} stroke={INK} strokeWidth="2.5" />

      {/* The rank, which is the thing the scan cannot tell you. */}
      <circle cx={x + 18} cy={y + 18} r="9.5" fill={accent} stroke={INK} strokeWidth="2.5" />
      <text
        x={x + 18}
        y={y + 18}
        textAnchor="middle"
        dominantBaseline="central"
        fill={on}
        style={{ font: `700 11px ${MONO}` }}
      >
        {rank}
      </text>

      {/* Two rules rather than lorem: the answer's words are the engine's, and
          drawing invented ones on the pricing page would be inventing a
          result. */}
      <g stroke={RULE} strokeWidth="4" strokeLinecap="round">
        <path d={`M${x + 34} ${y + 18}h${w - 46}`} />
        <path d={`M${x + 14} ${y + 38}h${w - 28}`} />
        <path d={`M${x + 14} ${y + 48}h${w - 46}`} />
      </g>
    </g>
  );
}

function Bot() {
  return (
    <g>
      {/* Antenna: up and lit, because this is the tier that is listening. */}
      <path d="M150 128v-14" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="150" cy="107" r="6" fill={LIME} stroke={INK} strokeWidth="2.5" />

      {/* Body first, so the head overlaps it the way a head does. */}
      <rect x="126" y="182" width="48" height="30" rx="10" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M126 194h-14" />
        <path d="M174 194h14" />
      </g>

      <rect x="116" y="128" width="68" height="58" rx="18" fill={WHITE} stroke={INK} strokeWidth="2.5" />
      <circle cx="136" cy="152" r="6" fill={LIME} stroke={INK} strokeWidth="2.5" />
      <circle cx="164" cy="152" r="6" fill={LIME} stroke={INK} strokeWidth="2.5" />
      <path d="M137 168q13 11 26 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}
