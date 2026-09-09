/**
 * The mark, in one place.
 *
 * It used to live in five: the Mark component, app/icon.svg, public/logo.svg,
 * public/bimi.svg and assets/icon/apple-icon.svg, each carrying the same paths
 * and a comment asking whoever edited one to remember the others. That comment
 * is the tell. This file is the drawing, `tools/build-logo.mjs` writes every
 * static derivative from it, and the component renders the same string, so
 * there is nothing left to keep in step by hand.
 *
 * The drawing is the bot from /bot, on a wave: same anatomy as BotScene's
 * surfing variant and as the grade bot on every result — rounded-rect head,
 * circle eyes, an antenna with a lit bulb — because it is the same character
 * and a mascot that changes proportions between the tab and the page reads as
 * two mascots.
 *
 * The palette is the system's, with one addition. Lime is the board, the eyes
 * and the chest panel; coral is the bulb; ink is every outline. The two blues
 * are the logo's own: the wave is lighter than the body so the character reads
 * against it, and neither is the brand violet, which stays a UI colour rather
 * than becoming a sea. A logo is allowed its own two colours; the interface is
 * not.
 *
 * Draw order is load-bearing. The wave comes before the board and the board
 * before the legs, so the bot rides the wave rather than floating in front of
 * it — the first version drew the wave last and it swallowed the board whole.
 *
 * The outer transform lifts and scales the drawing to fill the square. Drawn
 * at its natural coordinates the scene leaves a band of empty canvas above the
 * antenna, which at 28px in the header is a fifth of the mark spent on
 * nothing. Translating rather than rewriting every coordinate keeps the paths
 * legible against the artwork they came from.
 *
 * A word on small sizes: this is a scene, and a scene at 16px is a blue mark
 * with a pale fleck on it rather than a legible robot. That is the cost of a
 * pictorial logo over a letter, and it is paid knowingly — the old mark was a
 * bold lime b on a violet tile precisely because that reads at 16px. What
 * identifies the tab now is the silhouette and the two colours.
 */

export const MARK_VIEWBOX = '0 0 512 512';

/** Everything inside the <svg>. Shared by the component and the built files. */
export const MARK_BODY = `<g transform="translate(-20 -48) scale(1.08)"><g fill="none" stroke="#111318" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M96 258q16 10 5 26q-16-6-5-26z" fill="#2E7DF7"/>
  <path d="M152 212q14 9 4 24q-14-6-4-24z" fill="#2E7DF7"/>
  <path d="M0 512V424C22 378 60 334 116 318c48-14 92 4 104 38c12 34 74 52 154 60c64 6 112 16 138 30v64Z" fill="#2E7DF7"/>
  <path d="M126 374c-4-30 24-50 50-40c22 9 26 40 8 50c-18 11-54 8-58-10z" fill="#FFFFFF"/>
  <path d="M58 406q20-40 52-60" stroke-width="7"/>
  <path d="M24 460q8-32 26-54" stroke-width="7"/>
  <path d="M292 336l-14 44" stroke-width="13"/>
  <path d="M346 336l16 40" stroke-width="13"/>
  <g transform="rotate(-17 318 388)"><ellipse cx="318" cy="388" rx="124" ry="26" fill="#C6F53C"/></g>
  <path d="M300 136v-20" stroke-width="10"/>
  <circle cx="300" cy="102" r="14" fill="#FF6B5A"/>
  <path d="M274 262l-84-14" stroke-width="13"/>
  <path d="M366 258l86-16" stroke-width="13"/>
  <rect x="270" y="236" width="98" height="100" rx="28" fill="#2450E8"/>
  <rect x="291" y="266" width="56" height="26" rx="8" fill="#C6F53C" stroke-width="7"/>
  <rect x="264" y="134" width="108" height="90" rx="30" fill="#FFFFFF"/>
  <circle cx="297" cy="178" r="12" fill="#C6F53C" stroke-width="7"/>
  <circle cx="343" cy="176" r="12" fill="#C6F53C" stroke-width="7"/>
  <path d="M301 198q20 18 40-2" stroke-width="7"/>
</g></g>`;

/** A complete standalone document, for the files on disk and for the raster steps. */
export function markSvg(size?: number): string {
  const dims = size ? ` width="${size}" height="${size}"` : ' width="512" height="512"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}"${dims}>\n  <title>BotReady</title>\n  ${MARK_BODY}\n</svg>\n`;
}
