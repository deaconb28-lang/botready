/**
 * The bot, in four scenes.
 *
 * Decorative throughout: no data, no interactivity, no click targets. Each
 * scene carries an aria-label and is otherwise invisible to a screen reader,
 * because none of it says anything the surrounding prose does not.
 *
 * The path data is the drawing and is carried over from the handoff verbatim —
 * coordinates, stroke widths and radii unchanged. What is adapted to house
 * style is the wrapper card, the type face, and the palette: the handoff's
 * "sticker shop" generation is a shade off the one this site actually ships
 * (its lime is #D6F94A against our #C6F53C, its ink #16151C against our
 * #111318), and two limes side by side on the same page read as a mistake
 * rather than a decision. PALETTE below is the one place to change that back.
 *
 * Draw order matters and is deliberate. In the surfing scene the waves come
 * last so they cut across the board and the bot's feet, which is what makes it
 * read as in the water rather than above it.
 *
 * Every node that rotates or scales carries `br-fx`, which sets
 * `transform-box: fill-box`. Without it an SVG child's `transform-origin:
 * center` resolves against the viewport instead of the element, and the bot
 * swings in a wide arc off screen instead of bobbing in place.
 */

import { cx } from '@/components/ui';

export type BotVariant = 'surfing' | 'reading' | 'waiting' | 'refused';

/** House tokens, in the roles the handoff names. */
const PALETTE = {
  ink: '#111318',
  indigo: '#4B44F5',
  lime: '#C6F53C',
  coral: '#FF6B5A',
  paper: '#EDEBFB',
  white: '#FFFFFF',
} as const;

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

const LABEL: Record<BotVariant, string> = {
  surfing: 'A bot surfing a wave of web pages, with 200, 403 and llms.txt drifting past',
  reading: 'A bot reading a robots.txt file',
  waiting: 'A bot waiting between requests, one second apart',
  refused: 'A bot stopped at a boundary marked 403, not crossing it',
};

export function BotScene({
  variant = 'surfing',
  className = '',
  shadow = 'shadow-hard-6',
}: {
  variant?: BotVariant;
  className?: string;
  shadow?: string;
}) {
  return (
    <div className={cx('edge overflow-hidden rounded-[18px] bg-white', shadow, className)}>
      <svg
        viewBox={variant === 'surfing' ? '0 0 384 320' : '0 0 384 290'}
        width="100%"
        className="block"
        role="img"
        aria-label={LABEL[variant]}
      >
        <Backdrop height={variant === 'surfing' ? 320 : 290} />
        {variant === 'surfing' ? <Surfing /> : null}
        {variant === 'reading' ? <Reading /> : null}
        {variant === 'waiting' ? <Waiting /> : null}
        {variant === 'refused' ? <Refused /> : null}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ 1. canvas

/** The card is a window onto the same surface as the page behind it. */
function Backdrop({ height }: { height: number }) {
  return (
    <>
      <rect x="0" y="0" width="384" height={height} fill={PALETTE.paper} />
      <g stroke={PALETTE.ink} strokeWidth="1" opacity=".18">
        <path
          d={`M0 40H384M0 80H384M0 120H384M0 160H384M64 0V${height}M128 0V${height}M192 0V${height}M256 0V${height}M320 0V${height}`}
          strokeDasharray="3 7"
        />
      </g>
    </>
  );
}

// ------------------------------------------------------------------ the bot

/**
 * Everything that does not change between scenes: the antenna, the torso, the
 * chest light, the head and the eyes. Arms, legs and props are the scene's.
 *
 * The 7px round-capped limbs are what give it its chunky sticker-toy
 * proportions. Do not thin them.
 */
function BotBody() {
  return (
    <>
      <path d="M209 116V104" stroke={PALETTE.ink} strokeWidth="3" strokeLinecap="round" />
      <circle cx="209" cy="100" r="6.5" fill={PALETTE.coral} stroke={PALETTE.ink} strokeWidth="2.5" />
      <rect x="186" y="160" width="46" height="52" rx="14" fill={PALETTE.indigo} stroke={PALETTE.ink} strokeWidth="2.5" />
      <rect x="196" y="176" width="26" height="12" rx="4" fill={PALETTE.lime} stroke={PALETTE.ink} strokeWidth="2" />
      <rect x="182" y="116" width="54" height="46" rx="15" fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="2.5" />
      <circle cx="197" cy="139" r="6" fill={PALETTE.lime} stroke={PALETTE.ink} strokeWidth="2.5" />
      <circle cx="221" cy="139" r="6" fill={PALETTE.lime} stroke={PALETTE.ink} strokeWidth="2.5" />
    </>
  );
}

/** The antenna pinging. Two arcs, the outer one trailing the inner by .35s. */
function Signal() {
  return (
    <g stroke={PALETTE.ink} strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path className="br-fx br-ping-1" d="M196 96q13-13 26 0" />
      <path className="br-fx br-ping-2" d="M188 84q21-21 42 0" />
    </g>
  );
}

/** Standing legs, for the three scenes that are not in the water. */
function Standing() {
  return <path d="M194 212v30M224 212v30" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />;
}

/**
 * The floor the standing scenes stand on. A band rather than a line: the
 * surfing scene is anchored by its waves, and without the same weight down
 * here the others float in empty paper.
 */
function Floor() {
  return <rect x="-4" y="246" width="392" height="48" fill={PALETTE.ink} />;
}

function Sticker({
  x,
  y,
  width,
  height,
  radius,
  fill,
  chip,
  label,
  labelX,
  labelY,
  size,
  className = '',
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  chip?: { x: number; y: number; fill: string };
  label: string;
  labelX: number;
  labelY: number;
  size: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <rect x={x} y={y} width={width} height={height} rx={radius} fill={fill} stroke={PALETTE.ink} strokeWidth="2.5" />
      {chip ? (
        <rect x={chip.x} y={chip.y} width="14" height="14" rx="4" fill={chip.fill} stroke={PALETTE.ink} strokeWidth="2" />
      ) : null}
      <text x={labelX} y={labelY} fontFamily={MONO} fontSize={size} fontWeight="600" fill={PALETTE.ink}>
        {label}
      </text>
    </g>
  );
}

// ------------------------------------------------------------------ scenes

/**
 * The landing hero. Bots move across your site, and some of them wipe out.
 *
 * The wave periods are 200 units and both paths overhang the frame at both
 * ends, which is what lets a -200px translate loop without a seam. The
 * durations across the whole scene are deliberately uneven — 3.4, 5.6, 3.1,
 * 5.2, 4.1, 4.6 — so it never visibly resets in sync.
 */
function Surfing() {
  return (
    <>
      <Sticker
        className="br-fx br-float-1"
        x={34}
        y={46}
        width={66}
        height={30}
        radius={9}
        fill={PALETTE.white}
        chip={{ x: 42, y: 54, fill: PALETTE.lime }}
        label="200"
        labelX={62}
        labelY={66}
        size={11}
      />
      <Sticker
        className="br-fx br-float-2"
        x={286}
        y={30}
        width={66}
        height={30}
        radius={9}
        fill={PALETTE.white}
        chip={{ x: 294, y: 38, fill: PALETTE.coral }}
        label="403"
        labelX={314}
        labelY={50}
        size={11}
      />
      <Sticker
        className="br-fx br-float-3"
        x={292}
        y={112}
        width={70}
        height={26}
        radius={8}
        fill={PALETTE.lime}
        label="llms.txt"
        labelX={302}
        labelY={130}
        size={10}
      />

      <g className="br-fx br-bob">
        <Signal />
        <path d="M186 178l-24-16" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <path d="M232 178l26 12" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <BotBody />
        <path d="M186 210l-8 18M232 210l8 18" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <rect
          x="146"
          y="222"
          width="132"
          height="20"
          rx="10"
          fill={PALETTE.lime}
          stroke={PALETTE.ink}
          strokeWidth="2.5"
          transform="rotate(-7 212 232)"
        />
        <path d="M212 232h48" stroke={PALETTE.coral} strokeWidth="4" strokeLinecap="round" transform="rotate(-7 212 232)" />
      </g>

      <g stroke={PALETTE.ink} strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path className="br-spray-1" d="M150 232l-10-8" />
        <path className="br-spray-2" d="M144 244l-14-4" />
      </g>

      {/* Last, so they cut across the board and the feet. */}
      <g className="br-wave-front">
        <path
          d="M-20 262q50-26 100 0t100 0t100 0t100 0t100 0t100 0t100 0t100 0V320H-20Z"
          fill={PALETTE.indigo}
          stroke={PALETTE.ink}
          strokeWidth="2.5"
        />
      </g>
      <g className="br-wave-back">
        <path d="M-20 280q50-24 100 0t100 0t100 0t100 0t100 0t100 0t100 0t100 0V320H-20Z" fill={PALETTE.ink} />
      </g>
    </>
  );
}

/**
 * The crawler page's opening. The first request of every scan is
 * GET /robots.txt, and this is the bot reading the answer.
 */
function Reading() {
  return (
    <>
      <Sticker
        className="br-fx br-float-2"
        x={38}
        y={54}
        width={66}
        height={30}
        radius={9}
        fill={PALETTE.white}
        chip={{ x: 46, y: 62, fill: PALETTE.lime }}
        label="200"
        labelX={66}
        labelY={74}
        size={11}
      />
      <Floor />
      <g className="br-fx br-bob-soft">
        <Signal />
        <path d="M186 182l-16 18" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        {/* Held out to the side, so the torso and the chest light stay visible. */}
        <path d="M232 180l30-8" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <BotBody />
        <Standing />
        {/* Clear of the arm, so the bot is holding the file rather than fused to it. */}
        <g transform="rotate(-5 310 176)">
          <rect x="268" y="148" width="86" height="58" rx="10" fill={PALETTE.white} stroke={PALETTE.ink} strokeWidth="2.5" />
          <text x="278" y="170" fontFamily={MONO} fontSize="10" fontWeight="600" fill={PALETTE.ink}>
            robots.txt
          </text>
          <path d="M278 182h62M278 192h40" stroke={PALETTE.ink} strokeWidth="2.5" strokeLinecap="round" opacity=".3" />
        </g>
      </g>
    </>
  );
}

function Waiting() {
  return (
    <>
      <Sticker
        className="br-fx br-float-3"
        x={44}
        y={52}
        width={70}
        height={26}
        radius={8}
        fill={PALETTE.lime}
        label="GET /"
        labelX={54}
        labelY={70}
        size={10}
      />
      <Floor />
      <g className="br-fx br-bob-soft">
        <Signal />
        <path d="M186 182l-14 20" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <path d="M232 182l14 20" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <BotBody />
        <Standing />
      </g>
      <g stroke={PALETTE.ink} strokeWidth="2.5">
        <circle className="br-fx br-tick-1" cx="278" cy="196" r="7" fill={PALETTE.lime} />
        <circle className="br-fx br-tick-2" cx="304" cy="196" r="7" fill={PALETTE.lime} />
        <circle className="br-fx br-tick-3" cx="330" cy="196" r="7" fill={PALETTE.lime} />
      </g>
    </>
  );
}

/**
 * The page's moral centre, drawn: we ask once, and a refusal is the answer.
 * The bot's hand stops short of the boundary rather than touching it.
 */
function Refused() {
  return (
    <>
      <Floor />
      {/* The line it does not cross. */}
      <path d="M292 40V250" stroke={PALETTE.ink} strokeWidth="3" strokeDasharray="10 8" opacity=".55" />
      <Sticker
        className="br-fx br-float-2"
        x={259}
        y={104}
        width={66}
        height={30}
        radius={9}
        fill={PALETTE.white}
        chip={{ x: 267, y: 112, fill: PALETTE.coral }}
        label="403"
        labelX={287}
        labelY={124}
        size={11}
      />
      <g className="br-fx br-bob-soft">
        <path d="M232 176l22-12" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <path d="M186 182l-14 20" stroke={PALETTE.ink} strokeWidth="7" strokeLinecap="round" />
        <BotBody />
        <Standing />
      </g>
    </>
  );
}
