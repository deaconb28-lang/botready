'use client';

import { useEffect, useState } from 'react';

/** The palette, as hard little rectangles. No gradients, no rounded corners. */
const COLOURS = ['#C6F53C', '#4B44F5', '#FF6B5A', '#FFCF5C', '#111318', '#FFFFFF'];
const PIECES = 46;

/** The count-up in ReportHeader runs 1500ms. This lands just after it does. */
const AT_MS = 1700;
const LIFE_MS = 1800;

interface Piece {
  left: number;
  dx: string;
  spin: string;
  delay: number;
  dur: number;
  colour: string;
  w: number;
  h: number;
}

/**
 * Confetti, once, for a grade A, at the moment the number stops climbing.
 *
 * Three conditions, all of which have to hold:
 *
 *   - the grade is an A. Not "healthy", not 90-something. A B is a site three
 *     clients might still fail to read, and applauding one would make the
 *     applause worthless when it is earned.
 *   - the scan finished in this session. LiveScan leaves a note in
 *     sessionStorage on its way out and this consumes it, so opening somebody
 *     else's shared result — or your own, tomorrow — is quiet. A celebration
 *     is for the moment of finding out.
 *   - the reader has not asked for reduced motion.
 *
 * It renders nothing at all outside that, mounts for under two seconds, and
 * cannot be clicked through to anything.
 */
export function ScoreReveal({ grade, scanId }: { grade: string; scanId: string }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (!grade.startsWith('A')) return;

    // Fresh only. Wrapped because Safari in private mode throws on access.
    let fresh = false;
    try {
      const key = `botready:fresh:${scanId}`;
      fresh = sessionStorage.getItem(key) !== null;
      if (fresh) sessionStorage.removeItem(key);
    } catch {
      fresh = false;
    }
    if (!fresh) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const start = setTimeout(() => setPieces(build()), AT_MS);
    const end = setTimeout(() => setPieces(null), AT_MS + LIFE_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [grade, scanId]);

  if (!pieces) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0 overflow-visible"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="anim-confetti absolute block"
          style={{
            left: `${p.left}%`,
            top: '14vh',
            width: p.w,
            height: p.h,
            background: p.colour,
            border: p.colour === '#FFFFFF' ? '1px solid #111318' : undefined,
            ['--dx' as string]: p.dx,
            ['--spin' as string]: p.spin,
            ['--delay' as string]: `${p.delay}ms`,
            ['--dur' as string]: `${p.dur}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Built in the effect rather than at module scope, so the randomness happens
 * on the client and never lands in server-rendered markup for React to
 * disagree with on hydration.
 */
function build(): Piece[] {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  return Array.from({ length: PIECES }, () => ({
    left: rand(4, 96),
    dx: `${rand(-90, 90).toFixed(0)}px`,
    spin: `${rand(-720, 720).toFixed(0)}deg`,
    delay: Math.round(rand(0, 260)),
    dur: Math.round(rand(1100, 1700)),
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] as string,
    w: Math.round(rand(5, 9)),
    h: Math.round(rand(9, 16)),
  }));
}
