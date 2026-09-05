import { cx } from '@/components/ui';

/**
 * The mascot's head, wearing the grade.
 *
 * Same anatomy as the full bot on /bot — rounded-rect head, 2.5px ink outline,
 * circle eyes, antenna with a bulb — cropped to the head because beside a
 * 64px number a whole robot would be arguing with the thing it is reacting to.
 *
 * The face is the score said a second way. Somebody reads a D and has to
 * convert it; nobody has to convert a frown. Five states, and they are steps
 * rather than a gradient, because a grade is a step:
 *
 *   A  eyes open, smiling, antenna up and lit
 *   B  eyes open, mouth flat. Not unhappy, not pleased
 *   C  one eye narrowed, slight frown, head tilted. Confused
 *   D  coral eyes, frown, antenna drooping. Confused and sad
 *   F  eyes shut to bars, deep frown, antenna down and dark
 *
 * The eye colour carries the same meaning it carries everywhere else in the
 * product: lime is fine, coral is not.
 */

const INK = '#111318';
const WHITE = '#FFFFFF';
const LIME = '#C6F53C';
const CORAL = '#FF6B5A';

type Mood = 'A' | 'B' | 'C' | 'D' | 'F';

function moodFor(grade: string): Mood {
  const letter = grade.trim().charAt(0).toUpperCase();
  return letter === 'A' || letter === 'B' || letter === 'C' || letter === 'D' ? letter : 'F';
}

const TILT: Record<Mood, number> = { A: 0, B: 0, C: -5, D: -7, F: -9 };

/** How the antenna leans, and whether its bulb is lit. */
const ANTENNA: Record<Mood, { d: string; cx: number; cy: number; lit: boolean }> = {
  A: { d: 'M32 18V8', cx: 32, cy: 5, lit: true },
  B: { d: 'M32 18V9', cx: 32, cy: 6, lit: true },
  C: { d: 'M32 18V10', cx: 33, cy: 7, lit: true },
  D: { d: 'M32 18Q32 12 26 10', cx: 24, cy: 9, lit: false },
  F: { d: 'M32 18Q32 13 24 13', cx: 22, cy: 13, lit: false },
};

const MOUTH: Record<Mood, string> = {
  A: 'M24 47q8 8 16 0',
  B: 'M25 48h14',
  C: 'M25 49q7-5 14-1',
  D: 'M24 50q8-8 16 0',
  F: 'M23 51q9-10 18 0',
};

export function GradeBot({ grade, size = 74, className = '' }: { grade: string; size?: number; className?: string }) {
  const mood = moodFor(grade);
  const sad = mood === 'D' || mood === 'F';
  const eye = sad ? CORAL : LIME;

  return (
    <span
      // Decorative: the grade is already in a chip beside it and read out by
      // the sr-only line on the score. A frown does not need announcing twice.
      aria-hidden="true"
      className={cx('block flex-none', mood === 'A' && 'br-fx br-bob-soft', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <g transform={`rotate(${TILT[mood]} 32 40)`}>
          <path
            d={ANTENNA[mood].d}
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <circle
            cx={ANTENNA[mood].cx}
            cy={ANTENNA[mood].cy}
            r="5"
            fill={ANTENNA[mood].lit ? CORAL : WHITE}
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect x="8" y="18" width="48" height="40" rx="14" fill={WHITE} stroke={INK} strokeWidth="2.5" />

          {mood === 'F' ? (
            // Shut, rather than open and unhappy. The one grade where nothing
            // got through at all.
            <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
              <path d="M18 37h10" />
              <path d="M36 37h10" />
            </g>
          ) : (
            <>
              <circle cx="23" cy="37" r={mood === 'C' ? 4 : 5.5} fill={eye} stroke={INK} strokeWidth="2.5" />
              <circle cx="41" cy="37" r="5.5" fill={eye} stroke={INK} strokeWidth="2.5" />
              {/* One eye narrowed is what reads as confused rather than sad. */}
              {mood === 'C' ? (
                <path d="M18 32q5-3 10 0" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              ) : null}
              {/* Raised at the inner corners, which is worry. Sloping the
                  other way is anger, and an angry mascot reads as the product
                  being cross with the reader rather than sorry for them. */}
              {sad ? (
                <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none">
                  <path d="M17 32l10-3" />
                  <path d="M47 32l-10-3" />
                </g>
              ) : null}
            </>
          )}

          <path d={MOUTH[mood]} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </span>
  );
}
